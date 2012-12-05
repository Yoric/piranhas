(function () {
  "use strict";
  var eltMain = document.getElementById("main");
  var stop = false;

  var Sprite = function Sprite(id, x, y) {
    this._x = x || 0;
    this._y = y || 0;
    this.elt = document.getElementById(id);
    if (!this.elt) {
      throw new Error("Could not find sprite element");
    }
    this._changed = true;
    this.elt.style.position = "absolute";
  };
  Sprite.prototype = {
    get x() {
      return this._x;
    },
    get y() {
      return this._y;
    },
    set x(x) {
      this._x = x;
      this._changed = true;
    },
    set y(y) {
      this._y = y;
      this._changed = true;
    },
    update: function update() {
      this.elt.style.left = "" + this.x + "px";
      this.elt.style.top = "" + this.y + "px";
      this._changed = false;
    }
  };

  var Me = function Me(id, x, y) {
    Sprite.call(this, id, x, y);
  };
  Me.prototype = Object.create(Sprite.prototype);

  var Piranha = function Piranha(id, x, y) {
    Sprite.call(this, id, x, y);
  };
  Piranha.prototype = Object.create(Sprite.prototype);

  var state = {
    delta: {
      x: 0,
      y: 0
    },
    me: new Me("me", 100, 100),
    piranhas: null
  };

  // Create the piranhas

  (function() {
    const ENEMIES = 5;
    var piranhas = [];
    var width = eltMain.clientWidth;
    var height = eltMain.clientHeight;
    for (var i = 0; i < ENEMIES; ++i) {
      var element = document.createElement("div");
      var id = "piranha_" + i;
      element.id = id;
      element.textContent = "Y";
      document.body.appendChild(element);
      var x = Math.random() * width;
      var y = Math.random() * height;
      var fish = new Piranha(id, x, y);
      fish.update();
      piranhas.push(fish);
    }
    state.piranhas = piranhas;
  })();

  // Main event loop

  var requestAnimationFrame =
    window.requestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.msRequestAnimationFrame;

  if (!requestAnimationFrame) {
    alert("This application requires a browser implementing requestAnimationFrame");
    throw new Error("This application requires a browser implementing requestAnimationFrame");
  }

  var step = function step(timestamp) {
    if (stop) {
      return;
    }
    state.me.x += state.delta.x;
    state.me.y += state.delta.y;
    state.delta.x = 0;
    state.delta.y = 0;

    state.piranhas.forEach(function(fish) {
      var delta = normalize(state.me.x - fish.x, state.me.y - fish.y);
      if (delta) {
        fish.x += delta.dx;
        fish.y += delta.dy;
        fish.update();
      }
    });

    state.me.update();
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);

  // Handle inputs

  var onkeypress = function onkeypress(event) {
    var code;
    if ("key" in event) {
      // FIXME: TODO
      return;
    }
    if ("keyCode" in event || "which" in event) {
      code = event.keyCode || event.which;
      if (code == KeyEvent.DOM_VK_UP) {
        if (state.delta.y >= 0) {
          state.delta.y = -1;
        }
      } else if (code == KeyEvent.DOM_VK_DOWN) {
        if (state.delta.y <= 0) {
          state.delta.y = 1;
        }
      } else if (code == KeyEvent.DOM_VK_LEFT) {
        if (state.delta.x >= 0) {
          state.delta.x = -1;
        }
      } else if (code == KeyEvent.DOM_VK_RIGHT) {
        if (state.delta.x <= 0) {
          state.delta.x = 1;
        }
      } else if (code == KeyEvent.DOM_VM_ESCAPE || code == KeyEvent.DOM_VK_SPACE) {
        if (stop) {
          stop = false;
          requestAnimationFrame(step);
        } else {
          stop = true;
        }
      }
      return;
    }
    console.error("Could not determine key");
  };

  var normalize = function normalize(dx, dy) {
    var norm = Math.sqrt( dx * dx + dy * dy);
    if (norm == 0) {
      return null;
    }
    dx = dx / norm;
    if (isNaN(dx)) {
      return null;
    }
    dy = dy / norm;
    if (isNaN(dy)) {
      return null;
    }
    return {dx: dx, dy: dy};
  };

  var mouse = {
    down: false,
    x: null,
    y: null
  };
  var mousestep = function mousestep() {
    var dx = mouse.x - state.me.x;
    var dy = mouse.y - state.me.y;

    var delta = normalize(dx, dy);
    if (delta) {
      state.delta.x = delta.dx;
      state.delta.y = delta.dy;
    }

    if (mouse.down) {
      requestAnimationFrame(mousestep);
    }
  };
  var onmousedown = function onmousedown(event) {
    window.addEventListener("mousemove", onmousemove);
    mouse.down = true;
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    requestAnimationFrame(mousestep);
  };
  var onmouseup = function onmouseup(event) {
    window.removeEventListener("mousemove", onmousemove);
    mouse.down = false;
  };
  var onmousemove = function onmousemove(event) {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  };

  window.addEventListener("keypress", onkeypress);
  window.addEventListener("mousedown", onmousedown);
  window.addEventListener("mouseup", onmouseup);
  window.addEventListener("touchstart", onmousedown);
  window.addEventListener("touchmove", onmousemove);

})();