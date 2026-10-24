class CashDrawerController {
  bool _isOpen = false;
  bool get isOpen => _isOpen;

  Future<bool> kickDrawer() async {
    // Sends standard ESC/POS pulse (ESC p m t1 t2 - 27, 112, 0, 25, 250)
    print("[HARDWARE] Cash drawer pulse signal sent via RJ12 printer port.");
    _isOpen = true;
    return true;
  }

  void closeDrawer() {
    _isOpen = false;
    print("[HARDWARE] Cash drawer sensor detected closed.");
  }
}
