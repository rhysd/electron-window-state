'use strict';

var app = require('app');
var jsonfile = require('jsonfile');
var path = require('path');
var mkdirp = require('mkdirp');
var objectAssign = require('object-assign');
var deepEqual = require('deep-equal');

module.exports = function (options) {
  var screen = require('screen');
  var state;
  var winRef;
  var stateChangeTimer;
  var eventHandlingDelay = 100;
  var config = objectAssign({
    file: 'window-state.json',
    path: app.getPath('userData'),
    maximize: true,
    fullScreen: true
  }, options);
  var fullStoreFileName = path.join(config.path, config.file);

  function isNormal(win) {
    return !win.isMaximized() && !win.isMinimized() && !win.isFullScreen();
  }

  function hasBounds() {
    return state &&
      state.x !== undefined &&
      state.y !== undefined &&
      state.width !== undefined &&
      state.height !== undefined;
  }

  function validateState() {
    var isValid = state && hasBounds();
    if (isValid && state.displayBounds) {
      // Check if the display where the window was last open is still available
      var displayBounds = screen.getDisplayMatching(state).bounds;
      isValid = deepEqual(state.displayBounds, displayBounds, {strict: true});
    }
    return isValid;
  }

  function updateState(win) {
    win = win || winRef;
    if (!win) {
      return;
    }

    var winBounds = win.getBounds();
    if (isNormal(win)) {
      state.x = winBounds.x;
      state.y = winBounds.y;
      state.width = winBounds.width;
      state.height = winBounds.height;
    }
    state.isMaximized = win.isMaximized();
    state.isFullScreen = win.isFullScreen();
    state.displayBounds = screen.getDisplayMatching(winBounds).bounds;
  }

  function saveState(win) {
    // Update window state only if it was provided
    if (win) {
      updateState(win);
    }

    // Save state
    try {
      mkdirp.sync(path.dirname(fullStoreFileName));
      jsonfile.writeFileSync(fullStoreFileName, state);
    } catch (e) {
      // Don't care
    }
  }

  function stateChangeHandler() {
    // Handles both 'resize' and 'move'
    clearTimeout(stateChangeTimer);
    stateChangeTimer = setTimeout(updateState, eventHandlingDelay);
  }

  function closeHandler() {
    updateState();
  }

  function closedHandler() {
    // Unregister listeners and save state
    unmanage();
    saveState();
  }

  function manage(win) {
    if (config.maximize && state.isMaximized) {
      win.maximize();
    }
    if (config.fullScreen && state.isFullScreen) {
      win.setFullScreen(true);
    }
    win.on('resize', stateChangeHandler);
    win.on('move', stateChangeHandler);
    win.on('close', closeHandler);
    win.on('closed', closedHandler);
    winRef = win;
  }

  function unmanage() {
    if (winRef) {
      winRef.removeListener('resize', stateChangeHandler);
      winRef.removeListener('move', stateChangeHandler);
      clearTimeout(stateChangeTimer);
      winRef.removeListener('close', closeHandler);
      winRef.removeListener('closed', closedHandler);
      winRef = null;
    }
  }

  // Load previous state
  try {
    state = jsonfile.readFileSync(fullStoreFileName);
  } catch (err) {
    // Don't care
  }

  // Check state validity
  if (!validateState()) {
    state = null;
  }

  // Set state fallback values
  state = objectAssign({
    width: config.defaultWidth || 800,
    height: config.defaultHeight || 600
  }, state);

  return {
    get x() { return state.x; },
    get y() { return state.y; },
    get width() { return state.width; },
    get height() { return state.height; },
    get isMaximized() { return state.isMaximized; },
    get isFullScreen() { return state.isFullScreen; },
    saveState: saveState,
    unmanage: unmanage,
    manage: manage
  };
};
