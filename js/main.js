(function () {
  "use strict";
  var eltMain = document.getElementById("main");
  var eltScore = document.getElementById("score");
  var eltResult = document.getElementById("result");
  var eltResultPane = document.getElementById("result_pane");

  const PLAYER_SPEED = 0.3;
  const PIRANHA_SPEED = 0.2;

  var Sprite = function Sprite(id, x, y) {
    this._x = x || 0;
    this._y = y || 0;
    this.elt = document.getElementById(id);
    if (!this.elt) {
      throw new Error("Could not find sprite element");
    }
    this._changed = true;
    this.boundingRect = null;
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
      this.elt.style.left = this.x + "px";
      this.elt.style.top = this.y + "px";
      this._changed = false;
      this.boundingRect = this.elt.getBoundingClientRect();
    },
    collision: function collusion(sprite) {
      if (!sprite) {
        return false;
      }
      // FIXME: Make collision detection a little less harsh
      var horiz =
            (
              (this.boundingRect.left <= sprite.boundingRect.left) && (this.boundingRect.right >= sprite.boundingRect.left)
            ) ||
            (
              (this.boundingRect.left <= sprite.boundingRect.right) && (this.boundingRect.right >= sprite.boundingRect.right)
            );
      if (!horiz) {
        return false;
      }
      var vert =
            (
              (this.boundingRect.top <= sprite.boundingRect.top) && (this.boundingRect.bottom >= sprite.boundingRect.top)
            ) ||
            (
              (this.boundingRect.top <= sprite.boundingRect.bottom) && (this.boundingRect.bottom >= sprite.boundingRect.bottom)
            );
      return vert;
    },
    die: function die(timestamp) {
      var self = this;
      self.elt.classList.add("dying");
      self.elt.addEventListener("transition", function() {
        self.elt.classList.remove("dead");
        self.elt.classList.add("dead");
      });
    }
  };

  var Me = function Me(id, x, y) {
    Sprite.call(this, id, x, y);
  };
  Me.prototype = Object.create(Sprite.prototype);
  Me.prototype.reset = function reset() {
    this.elt.classList.remove("dead");
    this.elt.classList.remove("dying");
  };

  var Piranha = function Piranha(id, x, y) {
    Sprite.call(this, id, x, y);
  };
  Piranha.prototype = Object.create(Sprite.prototype);

  var randomNotCenter = function randomNotCenter() {
    var random = Math.random();
    var result;
    if (random < 0.5) {
      result = random / 2;
    } else {
      result = (1 - random) / 2 + 0.75;
    }
    return result;
  };

  var Game = {
    start: function start() {
      // Reset PC
      state.me.reset();

      // Reset enemies
      var piranhas = document.getElementsByClassName("piranha");
      var i;
      var element;
      console.log("We have", piranhas.length, "piranhas to remove");
      while (piranhas.length) {
        element = piranhas[0];
        console.log("Removing", element.id);
        element.parentElement.removeChild(element);
      }

      const ENEMIES = 18;
      piranhas = [];
      var width = eltMain.clientWidth;
      var height = eltMain.clientHeight;
      for (i = 0; i < ENEMIES; ++i) {
        element = document.createElement("div");
        var id = "piranha_" + i;
        element.id = id;
        element.classList.add("piranha");
        element.classList.add("sprite");
        document.body.appendChild(element);
        var x = randomNotCenter() * width;
        var y = randomNotCenter() * height;
        var fish = new Piranha(id, x, y);
        fish.update();
        piranhas.push(fish);
      }
      state.piranhas = piranhas;
      state.me.x = width / 2;
      state.me.y = height / 2;

	  //need to reset score after a pause
	  Game.totalTime = 0;
      this.chunkStart = Date.now();
      this.timestamp = Date.now();
      requestAnimationFrame(step);
    },
    pause: function pause() {
      if (this.isOver) {
        return;
      }
      if (this.isPaused) {
        this.isPaused = false;
        //reset game if uncomment this.start();
		this.chunkStart = Date.now();
		this.timestamp = Date.now();
		requestAnimationFrame(step);
      } else {
        this.isPaused = true;
      }
    },
    over: function over(isVictory) {
      eltResultPane.classList.remove("hidden");
      var text;
      if (isVictory) {
        text = "Victoria, my sombrero!";
      } else {
        text = "Game over, my sombrero! :(";
      }
      eltResult.textContent = text;
      var restart = function restart() {
        document.removeEventListener("click", restart);
        document.removeEventListener("touchend", restart);
        eltResultPane.classList.add("hidden");
        return Game.start();
      };
      window.setTimeout(function() {
        document.addEventListener("click", restart);
        document.addEventListener("touchend", restart);
      }, 500);
    },
    isPaused: false,
    isOver: false,
    chunkStart: null,
    totalTime: 0
  };

  var state = {
    delta: {
      x: 0,
      y: 0
    },
    me: new Me("me"),
    piranhas: null
  };

  // Create the piranhas


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
    // Handle pause
    var duration = timestamp - Game.timestamp;
    Game.timestamp = timestamp;

    var player_multiply = duration * PLAYER_SPEED;
    var piranha_multiply = duration * PIRANHA_SPEED;

    var elapsed = timestamp - Game.chunkStart;
    if (Game.isPaused) {
      Game.totalTime += elapsed;
      return;
    }

    // Handle movement
    state.me.x += state.delta.x * player_multiply;
    state.me.y += state.delta.y * piranha_multiply;
    state.me.update();

    state.piranhas.forEach(function (fish) {
      if (!fish || fish.isDying) { // Don't update for fishes that have eaten each other
        return;
      }
      var delta = normalizeDelta(state.me.x - fish.x, state.me.y - fish.y);
      if (delta) {
        fish.x += delta.dx * piranha_multiply;
        fish.y += delta.dy * piranha_multiply;
        fish.update();
      }
    });

    // Handle score

    eltScore.textContent = "Score: " + (Game.totalTime + elapsed);

    // Detect collisions

    var remainingFish = 0;
    for (var i = 0; i < state.piranhas.length; ++i) {
      var fish = state.piranhas[i];
      if (!fish) {
        continue;
      }
      if (fish.collision(state.me)) {
        state.me.die();
        Game.over(false);
        return;
      }
      for (var j = i + 1; j < state.piranhas.length; ++j) {
        var fish2 = state.piranhas[j];
        if (!fish2) {
          continue;
        }
        if (fish.collision(fish2)) {
          fish.die(timestamp);
          fish2.die(timestamp);
          state.piranhas[i] = null;
          state.piranhas[j] = null;
          // Will be removed at the next stage
        }
      }
      if (fish) {
        ++remainingFish;
      }
    }

    // Victory if there is 0 or 1 fish
    if (remainingFish <= 1) {
      Game.over(true);
      return;
    }

    // Loop

    requestAnimationFrame(step);
  };

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
        Game.pause();
      }
      return;
    }
    console.error("Could not determine key");
  };

  const EPSILON = 0.01;
  var normalizeDelta = function normalizeDelta(dx, dy) {
    var norm = Math.sqrt( dx * dx + dy * dy);
    if (norm <= EPSILON) {
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

  var onmousemove = function onmousemove(event) {
    event.preventDefault();
    event.stopPropagation();
    var dx = event.clientX - state.me.x;
    var dy = event.clientY - state.me.y;

    var delta = normalizeDelta(dx, dy);
    if (delta) {
      state.delta.x = delta.dx;
      state.delta.y = delta.dy;
    }
  };

  window.addEventListener("keypress", onkeypress);
  document.addEventListener("mousemove", onmousemove);
  document.addEventListener("touchmove", onmousemove);

  Game.start();
})();