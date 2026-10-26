import 'dart:convert';
import 'package:http/http.dart' as http;
import '../database/sqlite_helper.dart';
import 'conflict_resolver.dart';

class SyncEngine {
  final String backendUrl;
  final String terminalId;
  final ConflictResolver conflictResolver;
  bool _isSyncing = false;

  SyncEngine({
    this.backendUrl = 'http://localhost:3000/api/v1',
    this.terminalId = 'TERM-01',
    ConflictResolver? conflictResolver,
  }) : conflictResolver = conflictResolver ?? LastWriteWinsResolver();

  Future<int> queueLocalTransaction(String entityType, String entityId, String action, Map<String, dynamic> payload) async {
    final db = await SqliteHelper.database;
    final eventUuid = 'pos-outbox-${DateTime.now().millisecondsSinceEpoch}-${entityId.substring(0, 4)}';
    
    return await db.insert('sync_outbox', {
      'event_uuid': eventUuid,
      'entity_type': entityType,
      'entity_id': entityId,
      'action': action,
      'payload': jsonEncode(payload),
      'created_at': DateTime.now().toIso8601String(),
      'status': 'PENDING'
    });
  }

  Future<Map<String, dynamic>> pushOutbox() async {
    if (_isSyncing) return {'status': 'IN_PROGRESS'};
    _isSyncing = true;

    try {
      final db = await SqliteHelper.database;
      final pending = await db.query('sync_outbox', where: 'status = ?', whereArgs: ['PENDING'], limit: 50);

      if (pending.isEmpty) {
        _isSyncing = false;
        return {'status': 'IDLE', 'synced': 0};
      }

      final eventsPayload = pending.map((row) => {
        'event_uuid': row['event_uuid'],
        'entity_type': row['entity_type'],
        'entity_id': row['entity_id'],
        'action': row['action'],
        'delta_payload': jsonDecode(row['payload'] as String),
        'timestamp': row['created_at']
      }).toList();

      final res = await http.post(
        Uri.parse('$backendUrl/sync/ingest'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'terminal_id': terminalId,
          'events': eventsPayload
        })
      );

      if (res.statusCode == 200) {
        // Mark as synced
        final ids = pending.map((r) => r['id']).toList();
        await db.update('sync_outbox', {'status': 'SYNCED'}, where: 'id IN (${ids.join(",")})');
        _isSyncing = false;
        return {'status': 'SUCCESS', 'synced': ids.length};
      } else {
        _isSyncing = false;
        return {'status': 'FAILED', 'code': res.statusCode};
      }
    } catch (e) {
      _isSyncing = false;
      return {'status': 'OFFLINE_RETRY', 'error': e.toString()};
    }
  }
}
