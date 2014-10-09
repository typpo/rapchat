var BASE_FIREBASE_URL = 'https://kqw8tijfs91.firebaseio-demo.com/';

// Chats and stickers to show in the past
var BACK_HISTORY_MS = 60 * 1000;

var DEFAULT_ROOM = 'public';
if (~window.location.href.indexOf('localhost')) {
  DEFAULT_ROOM = 'test';
}

// Extent of message history, per room.
var MESSAGE_LIMIT = 50;

var currentName;
var onlineMap = {};
var onlineListRetrievedOnce = false;
var room = getQueryParam('r') || DEFAULT_ROOM;
var messagesRef = new Firebase(BASE_FIREBASE_URL + room);
var listRef = new Firebase(BASE_FIREBASE_URL + 'presence/');
var userRef = listRef.push();
var presenceRef = new Firebase(BASE_FIREBASE_URL + '.info/connected');

var loadTimeStamp = +new Date();

$(function() {
  sizeEverything();

  // Naming stuff
  // TODO delay this initial name setting until after first name list is retrieved, to prevent people from stealing names with n param/localstorage.
  changeNameTo(getQueryParam('n') || localStorage['preferredName']
               || 'anon' + parseInt(Math.random()*1000));

  // Initial values
  $('#name').val(currentName);
  $('#room').val(room);
  messagesRef.push({name: currentName, status: 'JOINED', ts: Firebase.ServerValue.TIMESTAMP});

  setupDomListeners();
  setupStickerButtons();
  setupPresenceHandlers();

  // Chat handler
  messagesRef.endAt().limit(MESSAGE_LIMIT).on('child_added', handleNewMessage);
});

function setupDomListeners() {
  // Message sending.
  $('#message').keypress(function(e) {
    if (e.keyCode == 13) {
      var name = $('#name').val();
      var text = $('#message').val().trim();
      if (text === '') {
        return;
      }
      if (text === '/clear') {
        // TODO fix this
        $('#clear').trigger('click');
        $('#message').val('');
        return;
      }
      messagesRef.push({name: currentName, text: text, ts: Firebase.ServerValue.TIMESTAMP});
      $('#message').val('');

      $('#message').attr('disabled', true);
      setTimeout(function() {
        $('#message').removeAttr('disabled');
        if (!isMobile()) {
          $('#message').focus();
        }
      }, 100);
    }
  });

  // Message box focus handlers
  if (isIFrame()) {
    $('#message').css({position: 'relative'});
  } else if (!isMobile()) {
    $('#message').focus();
  } else {
    // Message box moves to top of screen on mobile so virtual keyboard doesn't
    // cover it.
    var prevHeight;
    $('#message').focus(function() {
      prevHeight = $('#inputs').height()
      $('#inputs').css('height', 0);
      sizeEverything();
    }).blur(function() {
      $('#inputs').css('height', prevHeight);
      sizeEverything();
      scrollDown();
    });
  }

  // Name change.
  $('#changeName').on('click', function() {
    var newName = prompt('New name?', currentName);
    if (newName) {
      changeNameTo(newName);
    }
  });

  // Room change.
  $('#changeRoom').on('click', function() {
    var newRoom = prompt('Where to?', room);
    if (newRoom && newRoom !== room) {
      window.location.href = '?r=' + newRoom;
    }
  });

  // Invite
  $('#invite').on('click', function() {
    // TODO ask for phone number or email
    alert('NYI');
  });

  // Quit listener
  $(window).bind('beforeunload', function() {
    messagesRef.push({name: currentName, status: 'QUIT', ts: Firebase.ServerValue.TIMESTAMP});
  });
}

function setupStickerButtons() {
  // Create rap buttons
  STICKERS.forEach(function(sticker) {
    var display = sticker.audio.slice(5, sticker.audio.indexOf('.'));
    var button = $('<button>')
        .addClass('stickerButton')
        .text(display).data('slug', sticker.slug);

        /*
    $('<span>').addClass('stickerWrapper sticker artists-bigsean')
        .append(button)
        .appendTo($('#rapbuttons'));
        */
    var sticker = $('<div class="sticker artists-' + sticker.slug + '">')
        .data('slug', sticker.slug)
        .data('sticker', display)
        .append($('<span>').text(display))
        .appendTo($('#rapbuttons'));
  });

  // Add spacer
  $('#rapbuttons').append($('<div>').addClass('spacer'));

  // Rap buttons handler
  $('#rapbuttons .sticker').on('click', function() {
    var name = $('#name').val();
    messagesRef.push({
      name: currentName,
      sticker: $(this).data('sticker'),
      slug: $(this).data('slug'),
      ts: Firebase.ServerValue.TIMESTAMP
    });

    // TODO update this.
    $('#rapbuttons button').attr('disabled', true);
    setTimeout(function() {
      $('#rapbuttons button').removeAttr('disabled');
    }, 650);

    if (!isMobile()) {
      $('#message').focus();
    }
  });
}

function setupPresenceHandlers() {
  // Add ourselves to presence list when online.
  presenceRef.on('value', function(snap) {
    if (snap.val()) {
      userRef.set({name: currentName});
      // Remove ourselves when we disconnect.
      userRef.onDisconnect().remove();
    }
  });

  // Number of online users is the number of objects in the presence list.
  listRef.on('value', function(snap) {
    $('#onlineCount').text(snap.numChildren());
    var onlines = [];
    onlineMap = {};
    snap.forEach(function(userPresenceSnap) {
      var userPresence = userPresenceSnap.val();
      if (userPresence.name) {
        onlines.push(userPresence.name);
        onlineMap[userPresence.name] = true;
      } else {
        onlines.push('?');
      }
    });
    $('#onlineList').text(onlines.join(', '));
    onlineListRetrievedOnce = true;
  });
}

function newMessage(name, text, playNotification) {
  $('<p>').text(name + ': ' + text).appendTo($('#messages'));
  if (playNotification) {
    var sound = new Howl({
      urls: ['rapchat_notification.ogg'],
      volume: 1,
      autoplay: true
    });
  }
}

function newAction(name, text) {
  $('<p>').text(name + ' ' + text).addClass('newAction').appendTo($('#messages'));
}

function newSticker(name, sticker, slug, noPlay) {
  var sound = new Howl({
    urls: ['oggs/' + sticker + '.ogg', 'mp3s/' + sticker + '.mp3'],
    volume: 1
  });

  var sticker = $('<div class="sticker artists-' + slug + '"></div>');
  // TODO fix this.
  var sounddiv = $('<div style="float: left; margin-left: 150px; display:none;"><img src="images/sound.png" style=" width: 50px; height: auto;"></div>');
  var namediv = $('<div>').text(name + ':');
  $('<p>').append(namediv).append(sounddiv).append(sticker).appendTo($('#messages'));

  if (!noPlay) {
    sound.play();
    sounddiv.show().hide(600);
  }

  sticker.on('click', function() {
    sound.play();
    sounddiv.show().hide(600);
  });
}

function changeNameTo(newName) {
  var oldName = currentName;
  if (onlineMap[newName]) {
    alert('That name is already being used.');
    newName = 'anon' + parseInt(Math.random()*1000);
  }
  currentName = newName;
  if (oldName) {
    messagesRef.push({
      name: oldName,
      newname: currentName,
      status: 'NAMECHANGE',
      ts: Firebase.ServerValue.TIMESTAMP
    });
    userRef.set({name: currentName});
  }
  localStorage['preferredName'] = currentName;
}

function handleNewMessage(snapshot) {
  var message = snapshot.val();
  var partOfHistory = false;
  if (new Date().getTime() - message.ts > 10000 && message.ts < loadTimeStamp) {
    partOfHistory = true;
  }

  if (message.status) {
    switch(message.status) {
      case 'JOINED':
        newAction(message.name, 'has joined');
        break;
      case 'QUIT':
        newAction(message.name, 'has quit');
        break;
      case 'NAMECHANGE':
        newAction(message.name, 'is now known as ' + message.newname);
        break;
    }
  } else if (message.sticker) {
    // If it's in the past but we still want to show it, don't play noise.
    newSticker(message.name, message.sticker, message.slug, partOfHistory);
  } else {
    newMessage(message.name, message.text);
  }
  scrollDown();
  newMessageNotification();
}

function scrollDown() {
  $('#messages')[0].scrollTop = $('#messages')[0].scrollHeight;
}

function sizeEverything() {
  var fixedheight = $('#onlineStatusContainer').height() + $('#inputs').height();
  var windowheight = $(window).height();

  // TODO handle tiny dekstop window/resizes
  // TODO handle sizing better. Make sure it doesn't cut off last row of stickers.
  $('#messages').height(parseInt((windowheight - fixedheight) * .40));
  $('#rapbuttons').height(parseInt((windowheight - fixedheight) * .60));
}

function getQueryParam(name) {
  name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
  results = regex.exec(location.search);
  return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function isMobile() {
  return (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase()));
}

function isIFrame() {
  return getQueryParam('iframe') === '1';
}


/*** Message notifications and such ***/

var windowFocus = true;
$(window).focus(function() {
  windowFocus = true;
  stopMessageNotification();
}).blur(function() {
  windowFocus = false;
});

var newMessageInterval = null;
var originalTitle = document.title;
function newMessageNotification() {
  if (newMessageInterval || windowFocus) {
    return;
  }
  var flip = true;
  newMessageInterval = setInterval(function() {
    if (flip) {
      document.title = '!!! Message - RapChat';
    } else {
      document.title = originalTitle;
    }
    flip = !flip;
  }, 1000);
}

function stopMessageNotification() {
  if (newMessageInterval) {
    clearInterval(newMessageInterval);
    newMessageInterval = null;
    document.title = originalTitle;
  }
}

// Simple JavaScript Templating
// John Resig - http://ejohn.org/ - MIT Licensed
(function(){
  var cache = {};

  this.tmpl = function tmpl(str, data){
    // Figure out if we're getting a template, or if we need to
    // load the template - and be sure to cache the result.
    var fn = !/\W/.test(str) ?
      cache[str] = cache[str] ||
        tmpl(document.getElementById(str).innerHTML) :

      // Generate a reusable function that will serve as a template
      // generator (and which will be cached).
      new Function("obj",
        "var p=[],print=function(){p.push.apply(p,arguments);};" +

        // Introduce the data as local variables using with(){}
        "with(obj){p.push('" +

        // Convert the template into pure JavaScript
        str
          .replace(/[\r\t\n]/g, " ")
          .split("<%").join("\t")
          .replace(/((^|%>)[^\t]*)'/g, "$1\r")
          .replace(/\t=(.*?)%>/g, "',$1,'")
          .split("\t").join("');")
          .split("%>").join("p.push('")
          .split("\r").join("\\'")
      + "');}return p.join('');");

    // Provide some basic currying to the user
    return data ? fn( data ) : fn;
  };
})();
