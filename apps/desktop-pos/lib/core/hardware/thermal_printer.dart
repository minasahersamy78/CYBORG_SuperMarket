class ReceiptItem {
  final String name;
  final int quantity;
  final double unitPrice;
  final double total;

  ReceiptItem({
    required this.name,
    required this.quantity,
    required this.unitPrice,
    required this.total,
  });
}

class ReceiptData {
  final String storeName;
  final String storeAddress;
  final String receiptNumber;
  final String cashierName;
  final String terminalId;
  final DateTime timestamp;
  final List<ReceiptItem> items;
  final double subtotal;
  final double tax;
  final double total;
  final String paymentMethod;
  final double tendered;
  final double change;

  ReceiptData({
    required this.storeName,
    required this.storeAddress,
    required this.receiptNumber,
    required this.cashierName,
    required this.terminalId,
    required this.timestamp,
    required this.items,
    required this.subtotal,
    required this.tax,
    required this.total,
    required this.paymentMethod,
    required this.tendered,
    required this.change,
  });
}

abstract class ThermalPrinterAdapter {
  Future<bool> printReceipt(ReceiptData receipt);
  String formatAsciiReceipt(ReceiptData receipt);
}

class StandardThermalPrinter implements ThermalPrinterAdapter {
  @override
  Future<bool> printReceipt(ReceiptData receipt) async {
    // Generates formatted print buffer for USB/Network thermal printer
    final ascii = formatAsciiReceipt(receipt);
    print("--- THERMAL PRINTER OUTPUT ---\n$ascii\n------------------------------");
    return true;
  }

  @override
  String formatAsciiReceipt(ReceiptData receipt) {
    final buffer = StringBuffer();
    buffer.writeln("========================================");
    buffer.writeln("         ${receipt.storeName}           ");
    buffer.writeln("     ${receipt.storeAddress}            ");
    buffer.writeln("========================================");
    buffer.writeln("Receipt: ${receipt.receiptNumber}");
    buffer.writeln("Date:    ${receipt.timestamp.toIso8601String().substring(0, 19)}");
    buffer.writeln("Cashier: ${receipt.cashierName} (Term: ${receipt.terminalId})");
    buffer.writeln("----------------------------------------");
    buffer.writeln("Item                 Qty  Price    Total");
    buffer.writeln("----------------------------------------");

    for (final item in receipt.items) {
      final nameStr = item.name.length > 18 ? item.name.substring(0, 18) : item.name.padRight(18);
      buffer.writeln("$nameStr ${item.quantity.toString().padLeft(3)} ${item.unitPrice.toStringAsFixed(2).padLeft(7)} ${item.total.toStringAsFixed(2).padLeft(8)}");
    }

    buffer.writeln("----------------------------------------");
    buffer.writeln("Subtotal:               ${receipt.subtotal.toStringAsFixed(2).padLeft(12)} EGP");
    buffer.writeln("VAT (14%):              ${receipt.tax.toStringAsFixed(2).padLeft(12)} EGP");
    buffer.writeln("TOTAL:                  ${receipt.total.toStringAsFixed(2).padLeft(12)} EGP");
    buffer.writeln("----------------------------------------");
    buffer.writeln("Payment (${receipt.paymentMethod}):   ${receipt.tendered.toStringAsFixed(2).padLeft(12)} EGP");
    buffer.writeln("Change Due:             ${receipt.change.toStringAsFixed(2).padLeft(12)} EGP");
    buffer.writeln("========================================");
    buffer.writeln("     Thank you for shopping with us!    ");
    buffer.writeln("       Cyborg Omnichannel Retail        ");
    buffer.writeln("========================================");
    return buffer.toString();
  }
}
