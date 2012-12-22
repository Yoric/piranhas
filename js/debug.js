if (window.location.search.length > 1) {
  (function() {
    var args = window.location.search.substr(1).split("&");
    for (var arg of args) {
      console.log(arg);
      switch (arg) {
      case "debug":
        window.Piranhas.options.debug = true;
        break;
      case "nocoll":
        window.Piranhas.options.debugNoCollisions = true;
        break;
      case "nomov":
        window.Piranhas.options.debugNoMovements = true;
        break;
      case "profcoll":
        window.Piranhas.options.profileCollisions = true;
        break;
      case "profmov":
        window.Piranhas.options.profileMovement = true;
        break;
      case "profclean":
        window.Piranhas.options.profileCleanup = true;
        break;
      case "profscore":
        window.Piranhas.options.profileScore = true;
        break;
      }
    }
  })();
}