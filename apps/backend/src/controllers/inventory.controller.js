const inventoryService = require('../modules/inventory/inventory.service');

const InventoryController = {
  getBalance(productId, storeId = 1) {
    return inventoryService.getBalance(productId, storeId);
  },
  adjustStock(productId, deltaQty, reason, operatorId = 'system') {
    return inventoryService.adjustStock(productId, deltaQty, reason, operatorId);
  },
  reserveStock(items) {
    return inventoryService.reserveStock(items);
  },
  releaseReservation(items) {
    return inventoryService.releaseReservation(items);
  }
};

module.exports = InventoryController;
