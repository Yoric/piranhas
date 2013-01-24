(function () {
  "use strict";

  // DOM and dimensions
  var eltBackground = document.getElementById("background");
  var eltScores = document.getElementById("scores");
  var eltCurrentScore = document.getElementById("score");
  var eltHighScore = document.getElementById("high");
  var eltResult = document.getElementById("result");
  var eltCanvas = document.getElementById("canvas");
  var eltPause = document.getElementById("pause");
  var eltInfo = document.getElementById("info");
  var eltInstall = document.getElementById("ribbon_install");
  var eltFork = document.getElementById("ribbon_fork");

  var backgroundRect;
  var diagonal;
  var width;
  var height;

  var adjustSizeInProgress = null;
  var adjustSizeHelper = function adjustSizeHelper() {
      backgroundRect = eltBackground.getBoundingClientRect();
      width = Math.round(backgroundRect.width);
      height = Math.round(backgroundRect.height);
      diagonal =  Math.sqrt(width * width, height * height);
      console.log("Adjusting size", width, height, diagonal);
      eltCanvas.setAttribute("width", width);
      eltCanvas.setAttribute("height", height);
      adjustSizeInProgress = null;
  };
  var adjustSize = function adjustSize() {
    if (adjustSizeInProgress) {
      return;
    }
    adjustSizeInProgress = window.setTimeout(adjustSizeHelper, 70);
  };
  adjustSizeHelper();

  // Canvas

  var imgSprites = new window.Image();
  imgSprites.src = "img/sombrero_piranha.png";
  var imgGameOver = new window.Image();
  imgGameOver.src = "img/game_over.png";

  var canvasContext = eltCanvas.getContext("2d");
  canvasContext.fillStyle = "red";

  // Database
  var indexedDB =
    window.indexedDB ||
    window.mozIndexedDB ||
    window.webkitIndexedDB;
  var db;


  var sombreroPictureSize = 32;//size (px) picture sombrero
  // Gameplay options.
  var Options = {
    // The speed of the sombrero, in pixels per milliseconds
    sombreroSpeedFactor: 0.3,

    // The speed of piranhas, in pixels per milliseconds
    piranhaSpeedFactor: 0.2,

    // General speed factor
    speedFactor: Math.sqrt(diagonal) / 30,

    // The leniency of collision, in pixels (decrease this value
    // to make collisions more likely).
    collisionMargin: 3,

    // The number of piranhas to spawn when the game starts
    initialNumberOfPiranhas: Math.round(diagonal/100),

    // If |true|, the game doesn't end when all piranhas die
    infiniteMode: true,

    // If |true|, use an alternate infinite mode
    spawnMore: true,

    // Delay (in number of points) between two piranha respawns
    spawnEvery: 0.5,

    // If |true|, display visual feedback when user touches
    showFeedback: true,

    // If |true|, display visual feedback when the mouse moves
    showMouseFeedback: false,

    // Set to |true| to compute and display debug information
    debug: false,

    // Set to |true| to remove collision detection
    debugNoCollisions: false,

    // Set to |true| to remove movements
    debugNoMovements: false,

    debugNoClear: false,

    profileCollisions: false,
    profileMovement: false,
    profileCleanup: false,
    profileScore: false
  };

  // Statistics, useful for debugging
  var Statistics = {
    frame: 0,
    userTime: 0,
    collTime: 0,
    movTime: 0,
    framesSinceLastMeasure: 0,
    dateOfLastMeasure: 0,
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

  var collisionDistance = 29;

  /**
   * Implementation of a Sprite
   *
   * @param {Image} image The sprite sheet.
   * @param frames
   * @constructor
   */
  var Sprite = function Sprite(
    frames,
    x, y) {
    this._frames = frames;
    this.x = x || 0;
    this.y = y || 0;
    this.state = 0;
    this.isDying = false;
    this.isDead = false;
    this._dyingSinceStamp = 0;
  };
  Sprite.prototype = {
    update: function update(timeStamp) {
      var frame = this._frames[this.state];
      var width;
      var DEATH_DURATION = 300;
      if (this.isDying) {
        if (timeStamp - this._dyingSinceStamp >= DEATH_DURATION) {
          this.isDead = true;
          return;
        }
        width = Math.max(0.01, frame.w * (1 - (timeStamp - this._dyingSinceStamp) / DEATH_DURATION));
      } else {
        width = frame.w;
      }
      // Draw image
      canvasContext.drawImage(
        frame.image,
        frame.x,
        frame.y,
        width,
        frame.h,
        Math.round(this.x),
        Math.round(this.y),
        width,
        frame.h
      );
    },
    die: function die(timestamp) {
      this.isDying = true;
      this._dyingSinceStamp = timestamp;
    },
    reset: function reset() {
      this.state = 0;
      this.isDying = false;
      this.isDead = false;
    }
  };

  var Sombrero = function Sombrero() {
    var frames = [{image: imgSprites,
                   x:0,
                   y:0,
                   w:32,
                   h:32}];
    Sprite.call(this, frames);
  };
  Sombrero.prototype = Object.create(Sprite.prototype);

  var Piranha = function Piranha(x, y) {
    var frames = [{image: imgSprites,
                   x:32,
                   y:0,
                   w:32,
                   h:32}];
    Sprite.call(this, frames, x, y);
  };
  Piranha.prototype = Object.create(Sprite.prototype);
  Object.defineProperty(
    Piranha.prototype,
    "dx",
    {
      set: function set(dx) {
        this.x = Math.round(this.x + dx);
      }
    }
  );
  Object.defineProperty(
    Piranha.prototype,
    "dy",
    {
      set: function set(dy) {
        this.y = Math.round(this.y + dy);
      }
    }
  );

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
      // Now
      var now = Date.now();

      // Reset PC
      state.me.reset();

      // Reset enemies
      var piranhas = [];
      var i;
      var width = eltBackground.clientWidth;
      var height = eltBackground.clientHeight;
      for (i = 0; i < Options.initialNumberOfPiranhas; ++i) {
        var x = Math.round(randomNotCenter() * width);
        var y = Math.round(randomNotCenter() * height);
        var fish = new Piranha(x, y);
        fish.update(now);
        piranhas.push(fish);
      }
      state.piranhas = piranhas;
      state.me.x = width / 2;
      state.me.y = height / 2;

      // Clear score from previous game
      Statistics.framesSinceLastMeasure = 0;
      Statistics.userTime = 0;
      Statistics.collTime = 0;
      Statistics.movTime = 0;
      Statistics.cleanTime = 0;
      Statistics.scoreTime = 0;
      Statistics.dateOfLastMeasure = now;
      if (Options.debug) {
        Statistics.text = "<measuring> ";
      }
      this.frameNumber = 0;
      this.timestamp = Date.now();
      this.previousStamp = 0;
      this.chunkDuration = 0;
      this.currentScore = 0;
      this.isOver = false;
      this.latestSpawnDifficultyMultiplier = 0;
      this.fishesToRespawn = 0;
      this.touchX = 0;
      this.touchY = 0;
      this.touchTimestamp = 0;
      this.mouseX = 0;
      this.mouseY = 0;
      this.mouseTimestamp = 0;

      canvasContext.font = "bold xx-large 'Synchro LET',monospace";
      eltScores.classList.remove("high_score");

      requestAnimationFrame(step);
    },
    /**
     * Set the game on pause.
     *
     * Do nothing if the game is already on pause.
     */
    pause: function pause() {
      if (this.isPaused) {
        return;
      }
      this.isPaused = true;
      eltPause.classList.remove("hidden");
      eltInfo.classList.remove("hidden");
    },
    /**
     * Unpause the game.
     *
     * Do nothing if the game is not on pause.
     */
    unpause: function unpause() {
      if (!this.isPaused) {
        return;
      }
      this.isPaused = false;
      // Allow to resume the game
      this.chunkStart = Date.now();
      this.timestamp = Date.now();
      eltPause.classList.add("hidden");
      eltInfo.classList.add("hidden");
      requestAnimationFrame(step);
    },
    /**
     * Toggle between pause/unpause
     */
    togglePause: function togglePause() {
      if (this.isOver) {
        return;
      }
      if (this.isPaused) {
        this.unpause();
      } else {
        this.pause();
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
      // Store high score
      if (db && Game.currentScore == Game.highScore) {
        var transaction = db.transaction(["score"], "readwrite");
        var store = transaction.objectStore("score");
        var request = store.clear();
        request = store.add(Game.currentScore, Game.currentScore);
      }

      // Display "Game Over"
      var text;
      var measureText = canvasContext.measureText(text);
      var scaleText = 0.3 * (width / measureText.width);

      var scaleImage = 0.9 * Math.min(1, Math.min(width, height) / Math.max(imgGameOver.naturalWidth, imgGameOver.naturalHeight));
        if (isVictory) {
          text = "Victoria, my sombrero!";
        } else if (Game.currentScore == Game.highScore) {
          text = "New high score, sombrero mio!";
        } else {
          text = "Game over, my sombrero! :(";
        }

      var animationStartStamp = Date.now();
      var ANIMATION_DURATION = 300;
      var step = function step(timestamp) {
        var zoom = (timestamp - animationStartStamp) / ANIMATION_DURATION;
        if (zoom > 1) {
          // Animation is complete
          var restart = function restart() {
            document.removeEventListener("click", restart);
            document.removeEventListener("touchend", restart);
            document.removeEventListener("keydown", restart);
            eltInfo.classList.add("hidden");
            return Game.start();
          };
          document.addEventListener("click", restart);
          document.addEventListener("touchend", restart);
          document.addEventListener("keydown", restart);
          eltInfo.classList.remove("hidden");
          return;
        }
        Game.clearScreen();
        Game.handleDisplay(timestamp);
        canvasContext.fillStyle = "rgba(0, 0, 0, " + (zoom * 2 / 3) + ")";
        canvasContext.fillRect(0, 0, eltCanvas.width, eltCanvas.height);
        var imageWidth = imgGameOver.naturalWidth * scaleImage * zoom;
        var imageHeight = imgGameOver.naturalHeight * scaleImage * zoom;
        canvasContext.drawImage(imgGameOver,
                              (width - imageWidth) / 2,
                              (height - imageHeight) / 2,
                              imageWidth,
                              imageHeight
                             );
        canvasContext.fillStyle = "red";
        canvasContext.font = "bold " + (24 * zoom * scaleText) +
          "pt 'Synchro LET',monospace";

        var measureText = canvasContext.measureText(text);
        var textWidth = measureText.width;
        canvasContext.fillText(text,
                (width - textWidth) / 2 ,
                height / 2);
        canvasContext.setTransform(1, 0, 0, 1, 0, 0);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
    /**
     * Spawn or respawn piranhas as needed
     */
    handleSpawn: function handleSpawn(timestamp) {
      if (!Options.infiniteMode) {
        return;
      }
      var spawnFactor = Math.round(
        (this.difficultyMultiplier - this.latestSpawnDifficultyMultiplier) /
          Options.spawnEvery);
      if (spawnFactor <= 0) {
        return;
      }
      var numberOfSpawns = 0;
      if (Options.spawnMore) {
        if (this.fishesToRespawn > 0) {
          numberOfSpawns = 1;
          this.fishesToRespawn--;
        }
      } else {
        numberOfSpawns = spawnFactor;
      }
      if (numberOfSpawns <= 0) {
        return;
      }
      var myX = state.me.x;
      var myY = state.me.y;
      var width = eltBackground.clientWidth;
      var height = eltBackground.clientHeight;
      console.log("Spawning", numberOfSpawns, "piranhas");
      for (var i = 0; i < numberOfSpawns; ++i) {
        var x = Math.round((myX + (width / 4) * (1 + Math.random())) % width);
        var y = Math.round((myY + (height / 4) * (1 + Math.random())) % height);
        state.piranhas.push(new Piranha(x, y));
      }
      this.latestSpawnDifficultyMultiplier = this.difficultyMultiplier;
    },
    handleTime: function handleTime(timestamp) {
      var frameDuration = timestamp - this.timestamp;
      this.previousStamp = this.timestamp;
      this.timestamp = timestamp;
      this.chunkDuration = frameDuration;
      ++this.frameNumber;
    },
    handleDisplay: function handleDisplay(timestamp) {
      state.me.update(timestamp);
      for (var i = 0; i < state.piranhas.length; ++i) {
        var fish = state.piranhas[i];
        if (!fish) {
          continue;
        }
        fish.update(timestamp);
      }
      // Display visual feedback
      if (!Options.showFeedback) {
        return;
      }
      // Visual feedback for touch screen
      if (timestamp - this.touchTimestamp < 500) {
        canvasContext.strokeStyle = "green";
        var radius = Math.round(((timestamp - this.touchTimestamp) * 32) / 500);
        canvasContext.beginPath();
        canvasContext.arc(
          this.touchX,
          this.touchY,
          radius,
          0,
          Math.PI * 2,
          true);
        canvasContext.stroke();
      }
      if (!Options.showMouseFeedback) {
        return;
      }
      if (timestamp - this.mouseTimestamp < 500) {
        console.log("Visual feedback for mouse", state.me.x, state.me.y, this.mouseX, this.mouseY);
        canvasContext.strokeStyle = "green";
        canvasContext.beginPath();
        canvasContext.moveTo(state.me.x, state.me.y);
        canvasContext.lineTo(this.mouseX, this.mouseY);
        canvasContext.stroke();
      }
    },
    handleMovement: function handleMovement(timestamp) {
      if (Options.debugNoMovements) {
        // Skip movement, for debugging purposes
        return;
      }
      if (Options.profileMovement) {
        var timeStart = Date.now();
      }
      Game.difficultyMultiplier = Math.log(2 + Game.currentScore / 5000) / Math.log(2);
      var duration_multiplier = this.chunkDuration * Options.speedFactor * Game.difficultyMultiplier;
      Game.currentScore += Math.round(duration_multiplier);
      var player_multiply =  duration_multiplier * Options.sombreroSpeedFactor;
      var piranha_multiply = duration_multiplier * Options.piranhaSpeedFactor;


      var width = eltBackground.clientWidth;
      var height = eltBackground.clientHeight;

      // Cache this for performance
      var myX = state.me.x;
      var myY = state.me.y;

      // Handle movement
      state.me.x = boundBy(myX + state.delta.x * player_multiply,
        0, (width-sombreroPictureSize));//not overpass screen delimitation
      state.me.y = boundBy(myY + state.delta.y * player_multiply,
        0, (height-sombreroPictureSize));//not overpass screen delimitation

      for (var i = 0; i < state.piranhas.length; ++i) {
        var fish = state.piranhas[i];
        if (!fish) {  // Don't update for dead fishes
          continue;
        }
        var delta = normalizeDelta(fish.x - myX, fish.y - myY, piranha_multiply);
        if (delta) {
          fish.dx = -Math.round(delta.dx);
          fish.dy = -Math.round(delta.dy);
        }
      }
      if (Options.profileMovement) {
        var timeStop = Date.now();
        Statistics.movTime += timeStop - timeStart;
      }
    },
    handleCleanup: function handleCleanup() {
      if (Options.debugNoCleanup) {
        // Skip collision detection, for debugging purposes
        return;
      }
      if (this.frameNumber%2 == 0) {
        return;
      }
      if (Options.profileCleanup) {
        var timeStart = Date.now();
      }
      // Every second frame, clean up state.piranhas
      state.piranhas = state.piranhas.filter(
        function accept(x) {
          return (x != null) && !(x.isDead);
        }
      );
      state.piranhas.sort(
        function compare(a, b) {
          return a == null || (b != null && a.x <= b.x);
        }
      );
      if (!Options.infiniteMode && state.piranhas.length <= 1) {
        this.isOver = true;
        this.isVictory = true;
      }
      if (Options.profileCleanup) {
        var timeStop = Date.now();
        Statistics.cleanTime += timeStop - timeStart;
      }
    },
    handleCollisions: function handleCollision(timestamp) {
      if (Options.debugNoCollisions) {
        // Skip collision detection, for debugging purposes
        return;
      }
      if (this.frameNumber%2 == 1) {
        return;
      }
      if (Options.profileCollisions) {
        var timeStart = Date.now();
      }
      // Every second frame, detect collisions
      var collisionDetections = 0;
      var fishCollisions = 0;
      var length = state.piranhas.length;
      var half = Math.ceil(length);
      // Detect collisions of fishes between [start, stop[
      var fish, fish2;
      var i, j;
      var dx, dy;

      // Cache this for performance
      var myX = state.me.x;
      var myY = state.me.y;

      // Collisions between a fish and the sombrero
      for (i = 0; i < length; ++i) {
        fish = state.piranhas[i];
        if (fish.isDying) {
          continue;
        }
        collisionDetections++;
        dx = fish.x - myX;
        dy = fish.y - myY;

        if (dx * dx + dy * dy < collisionDistance * collisionDistance) {
          state.me.die(timestamp);
          this.isOver = true;
          this.isVictory = false;
          return;
        }
      }

      // Collisions between two fishes
      for (i = 0; i < length; ++i) {
        fish = state.piranhas[i];
        if (fish.isDying) {
          // If the fish has been eliminated, skip it
          continue;
        }

        for (j = i + 1; j < length; ++j) {
          fish2 = state.piranhas[j];
          if (fish2.isDying) {
            // If the fish has been eliminated, skip it
            continue;
          }

          collisionDetections++;
          dx = fish2.x - fish.x; // Necessarily >= 0
          if (dx >= collisionDistance) {
            // If fish2 is too far on the right, all further
            // fishes are too far on the right
            break;
          }
          if (dx * dx >= collisionDistance * collisionDistance) {
            continue;
          }

          dy = fish2.y - fish.y;
          if (dy * dy < collisionDistance * collisionDistance) {
            // We have a collision
            fish.die(timestamp);
            fish2.die(timestamp);
            ++fishCollisions;
          }
        }
      }
      if (fishCollisions > 0) {
        Game.fishesToRespawn += fishCollisions + 1;
        var deltaScore = 2 << fishCollisions;
        Game.score += deltaScore;
      }
      if (Options.profileCollisions) {
        var timeStop = Date.now();
        Statistics.collTime += timeStop - timeStart;
      }
    },
    handleScore: function handleScore() {
      if (Options.profileScore) {
        var timeStart = Date.now();
      }
      if (Game.currentScore > Game.highScore) {
        Game.highScore = Game.currentScore;
        eltScores.classList.add("high_score");
      }
      eltCurrentScore.textContent = Statistics.text + "Score: " + Game.currentScore;
      eltHighScore.textContent = " High: " + Game.highScore;
      if (Options.profileScore) {
        var timeStop = Date.now();
        Statistics.scoreTime += timeStop - timeStart;
      }
    },
    handleStatistics: function handleStatistics(timestamp) {
      if (!Options.debug) {
        return;
      }
      var now = Date.now();
      Statistics.framesSinceLastMeasure++;
      Statistics.userTime += now - timestamp;
      var deltaT = now - Statistics.dateOfLastMeasure;
      if (deltaT > 100) {
        var userTime = Statistics.userTime / Statistics.framesSinceLastMeasure;
        var fps = (1000 * Statistics.framesSinceLastMeasure) / deltaT;
        var text = Math.round(fps) + "fps, " + round(userTime) + "user, ";

        if (Options.profileCollisions) {
          var collTime = Statistics.collTime / Statistics.framesSinceLastMeasure;
          text += round(collTime) + "coll, ";
        }
        if (Options.profileCleanup) {
          var cleanTime = Statistics.cleanTime / Statistics.framesSinceLastMeasure;
          text += round(cleanTime) + "clean, ";
        }
        if (Options.profileMovement) {
          var movTime = Statistics.movTime / Statistics.framesSinceLastMeasure;
          text += round(movTime) + "mov, ";
        }
        if (Options.profileScore) {
          var scoreTime = Statistics.scoreTime / Statistics.framesSinceLastMeasure;
          text += round(scoreTime) + "score, ";
        }
        Statistics.text = text;
        Statistics.framesSinceLastMeasure = 0;
        Statistics.dateOfLastMeasure = now;
        Statistics.userTime = 0;
        Statistics.collTime = 0;
        Statistics.movTime = 0;
        Statistics.scoreTime = 0;
        Statistics.cleanTime = 0;
      }
    },
    clearScreen: function clearScreen() {
      if (Options.debugNoClear) {
        return;
      }
      canvasContext.clearRect(0, 0, eltCanvas.width, eltCanvas.height);
    },
    /**
     * true if the game is paused, false otherwise
     */
    isPaused: false,
    isOver: false,
    isVictory: false,
    /**
     * How many frames have been shown since the start of the game
     *
     * @type {number}
     */
    frameNumber: 0,
    /**
     * The date at which the latest |step| has started
     *
     * @type {number}
     */
    timestamp: 0,
    /**
     * The date at which the previous |step| has started
     *
     * @type {number}
     */
    previousStamp: 0,
    chunkDuration: 0,
    highScore: 0,
    currentScore: 0,
    /**
     * The number of fishes that need to be respawned
     */
    fishesToRespawn: 0,

    // Handling visual feedback for screen touched
    touchX: 0,
    touchY: 0,
    touchTimestamp: 0,

    // Handling visual feedback for mouse moved
    mouseX: 0,
    mouseY: 0,
    mouseTimestamp: 0
  };

  var state = {
    delta: {
      x: 0,
      y: 0
    },
    me: new Sombrero(0, 0),
    piranhas: null
  };

  // Create the piranhas


  // Main event loop

  var requestAnimationFrame =
    window.requestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    function emulateRequestAnimationFrame(f) {
      window.setTimeout(f, 15);
    };

  var step = function step() {
    var timestamp = Date.now();
    console.log("Timestamp", timestamp);
    Game.handleTime(timestamp);
    if (Game.isPaused) {
      return;
    }
    if (Game.isOver) {
      Game.over(Game.isVictory);
      return;
    }
    Game.clearScreen(timestamp);
    Game.handleMovement(timestamp);
    Game.handleCleanup(timestamp);
    Game.handleDisplay(timestamp);
    Game.handleCollisions(timestamp);
    Game.handleSpawn(timestamp);
    Game.handleScore(timestamp);
    Game.handleStatistics(timestamp);

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
        Game.togglePause();
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
  var boundBy = function boundBy(x, min, max) {
    if (x <= min) {
      return min;
    }
    if (x >= max) {
      return max;
    }
    return x;
  };

  var round = function round(x) {
    return Math.round(100 * x) / 100;
  };

  var EPSILON = 0.01;
  var normalizeDelta = function normalizeDelta(dx, dy, desiredNorm) {
    var norm = Math.sqrt( dx * dx + dy * dy);
    if (norm <= EPSILON) {
      return null;
    }
    dx = (dx / norm) * desiredNorm;
    if (isNaN(dx)) {
      return null;
    }
    dy = (dy / norm) * desiredNorm;
    if (isNaN(dy)) {
      return null;
    }
    return {dx: dx, dy: dy};
  };

  var oninput = function oninput(event) {
    var dx = event.clientX - state.me.x;
    var dy = event.clientY - state.me.y;

    var delta = normalizeDelta(dx, dy, 1);
    if (delta) {
      state.delta.x = delta.dx;
      state.delta.y = delta.dy;
    }
  };
  var onmousemove = function onmousemove(event) {
    event.stopPropagation();
    Game.mouseX = event.clientX;
    Game.mouseY = event.clientY;
    Game.mouseTimestamp = Date.now();
    oninput(event);
  };
  var ontouch = function ontouch(event) {
    event.stopPropagation();
    Game.unpause();
    Game.touchX = event.clientX;
    Game.touchY = event.clientY;
    Game.touchTimestamp = Date.now();
    oninput(event);
  };

  window.addEventListener("keydown", onkeypress);
  window.addEventListener("blur", Game.onblur.bind(Game));
  document.addEventListener("mousemove", onmousemove);
  document.addEventListener("click", ontouch);
  document.addEventListener("touchmove", ontouch);
  window.addEventListener("resize", adjustSize);

  // Load all resources before starting

  imgSprites.onload = function() {
    imgGameOver.onload = function() {
      var fail = function fail() {
        Game.start();
      };
      if (!indexedDB) {
        fail();
      }

      // Open the database
      var request = indexedDB.open("piranhas", 1);
      request.onfailure = fail;
      request.onblocked = function onblocked(event) {
        console.log("Database is blocked", event);
        fail();
      };
      request.onsuccess = function onsuccess(event) {
        db = event.target.result;

        // Fetch previous high score
        var request = db.transaction("score").objectStore("score").openCursor();
        request.onsuccess = function onsuccess(event) {
          var cursor = event.target.result;
          if (cursor) {
            // There is only one score, so we don't need to do much here
            Game.highScore = cursor.value;
          }
          Game.start();
        };
      };
      request.onupgradeneeded = function onupgradeneeded(event) {
        try {
          var store = event.target.result.createObjectStore("score");
        } catch (ex) {
          console.log("Could not create object store", ex);
        }
      };
    };
  };

  // Setup installer only on Firefox
  if ("mozApps" in window.navigator) {
    var request = window.navigator.mozApps.getSelf();
    request.onerror = function onerror() {
      console.log("Cannot determine whether application is installed", request.error.message);
    };
    request.onsuccess = function onsuccess() {
      if (request.result && request.result.manifest.name) {
        console.log("Application is already installed", request);
        eltInstall.style.visibility = "hidden";
        return;
      } else {
        console.log("Application isn't installed yet", request);
      }
      console.log("Setting up installer", request);
      var install = function install(event) {
        console.log("Installation requested");
        event.preventDefault();
        event.stopPropagation();
        var request = window.navigator.mozApps.install("http://yoric.github.com/piranhas/manifests/piranha.webapp");
        request.onsuccess = function () {
          // Save the App object that is returned
          var appRecord = this.result;
          console.log('Installation successful!', appRecord);
        };
        request.onerror = function (e) {
          // Display the error information from the DOMError object
          console.log('Installation failed!', e);
        };
      };
      eltInstall.addEventListener("click", install);
      eltInstall.addEventListener("touchend", install);
    };
  } else {
    console.log("Hiding installer");
    eltInstall.style.visibility = "hidden";
  }

  // Exported code
  window.Piranhas = {
    options: Options,
    statistics: Statistics
  };

  // Debugging code
  if (window.location.search.length > 1) {
    (function() {
      var args = window.location.search.substr(1).split("&");
      var i;
      for (i = 0; i < args.length; ++i) {
        var arg = args[i];
        console.log("Additional argument", arg);
        switch (arg) {
        case "debug":
          Options.debug = true;
          break;
        case "nocoll":
          Options.debugNoCollisions = true;
          break;
        case "noclear":
          Options.debugNoClear = true;
          break;
        case "morepiranhas":
          Options.initialNumberOfPiranhas *= 5;
          break;
        case "noinfinite":
          Options.infiniteMode = false;
          break;
        case "nospawnmore":
          Options.spawnMore = false;
          break;
        case "nomov":
          Options.debugNoMovements = true;
          break;
        case "profcoll":
          Options.profileCollisions = true;
          break;
        case "profmov":
          Options.profileMovement = true;
          break;
        case "profclean":
          Options.profileCleanup = true;
          break;
        case "profscore":
          Options.profileScore = true;
          break;
        case "touch":
          Options.showFeedback = true;
          break;
        case "notouch":
          Options.showFeedback = false;
          break;
        case "nobackground":
          eltBackground.classList.add("hidden");
          break;
        }
      }
    })();
  }
})();