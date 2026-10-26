abstract class ConflictResolver {
  Map<String, dynamic> resolve({
    required Map<String, dynamic> localState,
    required Map<String, dynamic> cloudState,
  });
}

class LastWriteWinsResolver implements ConflictResolver {
  @override
  Map<String, dynamic> resolve({
    required Map<String, dynamic> localState,
    required Map<String, dynamic> cloudState,
  }) {
    final localTime = DateTime.tryParse(localState['updated_at'] ?? '') ?? DateTime.fromMillisecondsSinceEpoch(0);
    final cloudTime = DateTime.tryParse(cloudState['updated_at'] ?? '') ?? DateTime.fromMillisecondsSinceEpoch(0);

    // If local mutation is newer, retain local; otherwise accept cloud state
    if (localTime.isAfter(cloudTime)) {
      return localState;
    }
    return cloudState;
  }
}
