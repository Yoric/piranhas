(function () {
  "use strict";
  var eltDebug = document.getElementById("debug");

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
    if (up) {
      eltDebug.textContent += "up ";
      up = false;
    }
    if (down) {
      eltDebug.textContent += "down ";
      down = false;
    }
    if (left) {
      eltDebug.textContent += "left ";
      left = false;
    }
    if (right) {
      eltDebug.textContent += "right ";
      right = false;
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);

  // Handle inputs

  var up = false;
  var down = false;
  var left = false;
  var right = false;

  var onkeypress = function onkeypress(event) {
    var code;
    if ("key" in event) {
      // FIXME: TODO
    } if ("keyCode" in event) {
      code = event.keyCode;
      if (code == KeyEvent.DOM_VK_UP) {
        up = true;
      } else if (code == KeyEvent.DOM_VK_DOWN) {
        down = true;
      } else if (code == KeyEvent.DOM_VK_LEFT) {
        left = true;
      } else if (code == KeyEvent.DOM_VK_RIGHT) {
        right = true;
      }
    } else if ("which" in event) {
      code = event.keyCode;
      if (code == KeyEvent.DOM_VK_UP) {
        up = true;
      } else if (code == KeyEvent.DOM_VK_DOWN) {
        down = true;
      } else if (code == KeyEvent.DOM_VK_LEFT) {
        left = true;
      } else if (code == KeyEvent.DOM_VK_RIGHT) {
        right = true;
      }
    }
    console.log("Key", event.key, event.keyCode, event.which);
  };
  window.addEventListener("keypress", onkeypress);
})();