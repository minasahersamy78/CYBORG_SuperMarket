const ordersService = require('../modules/orders/orders.service');

const OrdersController = {
  create(dto, actor = null) {
    return ordersService.createOrder(dto, actor);
  },
  list(query) {
    return ordersService.listOrders(query);
  },
  getById(id) {
    return ordersService.getOrderById(id);
  },
  cancel(id, reason, actor = null) {
    return ordersService.cancelOrder(id, reason, actor);
  },
  updateStatus(id, status, actor = null) {
    return ordersService.updateStatus(id, status, actor);
  },
  refund(id, reason, actor = null) {
    return ordersService.processRefund(id, reason, actor);
  }
};

module.exports = OrdersController;
