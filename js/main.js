(function () {
  "use strict";
  var eltMain = document.getElementById("main");
  var eltScore = document.getElementById("score");
  var eltResult = document.getElementById("result");
  var eltResultPane = document.getElementById("result_pane");

  // Gameplay options.
  var Options = {
    // The speed of the sombrero, in pixels per milliseconds
    sombreroSpeedFactor: 0.3,

    // The speed of piranhas, in pixels per milliseconds
    piranhaSpeedFactor: 0.2,

    // The leniency of collision, in pixels (decrease this value
    // to make collisions more likely).
    collisionMargin: 3,

    // The number of piranhas to spawn when the game starts
    initialNumberOfPiranhas: 18,

    // Set to |true| to compute and display debug information
    debug: false,

    // Set to |true| to remove collision detection
    debugNoCollisions: false
  };

  // Statistics, useful for debugging
  var Statistics = {
    frame: 0,
    userTime: 0,
    averageUserTime: null,
    averageFPS: null,
    latestUpdate: 0,
    text: ""
  };

  // Compatibility
  if (!("KeyEvent" in window)) {
    // Chrome does not define key event constants
    window.KeyEvent = {
      DOM_VK_ESCAPE: 27,
      DOM_VK_SPACE: 32,
      DOM_VK_LEFT: 37,
      DOM_VK_UP: 38,
      DOM_VK_RIGHT: 39,
      DOM_VK_DOWN: 40
    };
  }


  var Cache = {
    // Optimization: reusing DOM nodes
    _divElements: [],
    getDivElement: function() {
      var elt;
      if (this._divElements.length != 0) {
        elt = this._divElements.pop();
        elt.classList.remove("cache");
      } else {
        elt = document.createElement("div");
        document.body.appendChild(elt);
      }
      return elt;
    },
    recycle: function(elt) {
      elt.removeEventListener("transitionend", onrecycle);
      elt.className = "cache";
      this._divElements.push(elt);
    },
    _transformPropertyName: null,
    get transformPropertyName() {
      if (this._transformPropertyName) {
        return this._transformPropertyName;
      }
      var names = [
        "transform",
        "WebkitTransform",
        "msTransform",
        "MozTransform",
        "OTransform"
      ];
      for (var i = 0; i < names.length; ++i) {
        if (typeof eltMain.style[names[i]] != "undefined") {
          return this._transformPropertyName = names[i];
        }
      }
      return null;
    }
  };
  var onrecycle = function onrecycle(e) {
    Cache.recycle(e.target);
  };

  var Sprite = function Sprite(elt, x, y) {
    this._x = x || 0;
    this._y = y || 0;
    this.elt = elt;
    if (!this.elt) {
      throw new Error("Could not find sprite element");
    }
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
      // Prevent the sombrero from leaving the screen along x
      this._x = bounded(x, 0, eltMain.clientWidth - 32);
    },
    set y(y) {
      // Prevent the sombrero from leaving the screen along y
      this._y = bounded(y, 0, eltMain.clientHeight - 32);
    },
    update: function update() {
      var transform = Cache.transformPropertyName;
      if (transform) {
        var value = "translate(" + Math.round(this.x) + "px, "
              + Math.round(this.y) +"px)";
        this.elt.style[transform] = value;
      } else {
        this.elt.style.left = Math.round(this.x) + "px";
        this.elt.style.top = Math.round(this.y) + "px";
      }
      this.boundingRect = this.elt.getBoundingClientRect();
    },
    collision: function collusion(sprite) {
      if (Options.debugNoCollisions) {
        return false;
      }
      if (!sprite) {
        return false;
      }
      var collisionMargin = Options.collisionMargin;
      var horiz =
            (
              (this.boundingRect.left <= (sprite.boundingRect.left - collisionMargin)) && (this.boundingRect.right >= sprite.boundingRect.left - collisionMargin)
            ) ||
            (
              (this.boundingRect.left <= (sprite.boundingRect.right - collisionMargin)) && (this.boundingRect.right >= sprite.boundingRect.right - collisionMargin)
            );
      if (!horiz) {
        return false;
      }
      var vert =
            (
              (this.boundingRect.top <= (sprite.boundingRect.top - collisionMargin)) && (this.boundingRect.bottom >= sprite.boundingRect.top - collisionMargin)
            ) ||
            (
              (this.boundingRect.top <= (sprite.boundingRect.bottom - collisionMargin)) && (this.boundingRect.bottom >= sprite.boundingRect.bottom - collisionMargin)
            );
      return vert;
    },
    die: function die(timestamp) {
      var self = this;
      self.elt.classList.add("dying");
    }
  };

  var Sombrero = function Sombrero(x, y) {
    Sprite.call(this, document.getElementById("me"), x, y);
  };
  Sombrero.prototype = Object.create(Sprite.prototype);
  Sombrero.prototype.reset = function reset() {
    this.elt.classList.remove("dead");
    this.elt.classList.remove("dying");
  };

  var Piranha = function Piranha(x, y) {
    var elt = Cache.getDivElement();
    elt.classList.add("piranha");
    elt.classList.add("sprite");
    elt.addEventListener("transitionend", onrecycle);
    Sprite.call(this, elt, x, y);
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
      while(piranhas.length) {
        Cache.recycle(piranhas[0]);
      }

      piranhas = [];
      var width = eltMain.clientWidth;
      var height = eltMain.clientHeight;
      for (i = 0; i < Options.initialNumberOfPiranhas; ++i) {
        var x = randomNotCenter() * width;
        var y = randomNotCenter() * height;
        var fish = new Piranha(x, y);
        fish.update();
        piranhas.push(fish);
      }
      state.piranhas = piranhas;
      state.me.x = width / 2;
      state.me.y = height / 2;

      // Clear score from previous game
      Statistics.framesSinceLastMeasure = 0;
      Statistics.userTime = 0;
      Statistics.dateOfLastMeasure = Date.now();
      if (Options.debug) {
        Statistics.text = "<measuring> ";
      }
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
        // Allow to resume the game
        this.chunkStart = Date.now();
        this.timestamp = Date.now();
        requestAnimationFrame(step);
      } else {
        this.isPaused = true;
      }
    },
    onblur: function onblur() {
      if (this.isOver || this.isPaused) {
        return;
      }
      else {
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
    me: new Sombrero(),
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
    var previousStamp = Game.timeStamp;
    Game.timestamp = timestamp;

    var player_multiply = duration * Options.sombreroSpeedFactor;
    var piranha_multiply = duration * Options.piranhaSpeedFactor;

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
      if (!fish) { // Don't update for fishes that have eaten each other
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

    eltScore.textContent = Statistics.text + "Score: " + (Game.totalTime + elapsed);

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

    // Clean up `state.piranhas` every once in a while
    if (remainingFish < state.piranhas.length / 2) {
      var piranhas = [];
      for (i = 0 ; i < state.piranhas.length; ++i) {
        piranhas.push(state.piranhas[i]);
        // If |state.piranhas[i] == null|, this doesn't do anything
      }
      state.piranhas = piranhas;
    }

    // Update statistics
    if (Options.debug) {
      var now = Date.now();
      Statistics.framesSinceLastMeasure++;
      var deltaT = now - Statistics.dateOfLastMeasure;
      if (deltaT > 1000) {
        var userTime = Statistics.userTime / Statistics.framesSinceLastMeasure;
        var fps = (1000 * Statistics.framesSinceLastMeasure) / deltaT;
        Statistics.text = Math.round(fps) + "fps, " + Math.round(userTime) + "ms JS/frame, ";

        Statistics.framesSinceLastMeasure = 0;
        Statistics.dateOfLastMeasure = now;
        Statistics.userTime = 0;
      } else {
        Statistics.userTime += now - timestamp;
      }
    }

    // Loop

    requestAnimationFrame(step);
  };

  // Handle inputs

  var onkeypress = function onkeypress(event) {
    var code;
    if ("key" in event) {
      console.error("FIXME: Handle event.key");
    }
    if ("keyCode" in event || "which" in event) {
      code = event.keyCode || event.which;
      if (code == window.KeyEvent.DOM_VK_UP) {
        if (state.delta.y >= 0) {
          state.delta.y = -1;
        }
      } else if (code == window.KeyEvent.DOM_VK_DOWN) {
        if (state.delta.y <= 0) {
          state.delta.y = 1;
        }
      } else if (code == window.KeyEvent.DOM_VK_LEFT) {
        if (state.delta.x >= 0) {
          state.delta.x = -1;
        }
      } else if (code == window.KeyEvent.DOM_VK_RIGHT) {
        if (state.delta.x <= 0) {
          state.delta.x = 1;
        }
      } else if (code == window.KeyEvent.DOM_VM_ESCAPE || code == window.KeyEvent.DOM_VK_SPACE) {
        Game.pause();
      }
      return;
    }
    console.error("Could not determine key");
  };

  /**
   * Return the value in an interval closest to `x`.
   *
   * If `x` is between `min` and `max`, return `x`.
   * Otherwise, if `x` is below `min`, return `min`.
   * Otherwise, `x` is larger than `max`, return `max`.
   */
  var bounded = function bounded(x, min, max) {
    if (x <= min) {
      return min;
    }
    if (x >= max) {
      return max;
    }
    return x;
  };

  var EPSILON = 0.01;
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
    if (event.target == state.me.elt) {
      // Prevent some shaking
      state.delta.x = 0;
      state.delta.y = 0;
      return;
    }
    var dx = event.clientX - state.me.x;
    var dy = event.clientY - state.me.y;

    var delta = normalizeDelta(dx, dy);
    if (delta) {
      state.delta.x = delta.dx;
      state.delta.y = delta.dy;
    }
  };

  window.addEventListener("keydown", onkeypress);
  window.addEventListener("blur", Game.onblur.bind(Game));
  document.addEventListener("mousemove", onmousemove);
  document.addEventListener("touchmove", onmousemove);
  Game.start();

  window.Piranhas = {
    options: Options,
    statistics: Statistics
  };
})();