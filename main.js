var BASE_FIREBASE_URL = 'https://kqw8tijfs91.firebaseio-demo.com/';

// Chats and stickers to show in the past
var BACK_HISTORY_MS = 60 * 1000;

// Extent of message history, per room.
var MESSAGE_LIMIT = 300;

$(function() {
  var room = getQueryParam('r') || 'public';
  var currentName = getQueryParam('n') || localStorage['preferredName'] || 'anon' + parseInt(Math.random()*1000);
  var messagesRef = new Firebase(BASE_FIREBASE_URL + room);

  // Initial values
  $('#name').val(currentName);
  $('#room').val(room);
  messagesRef.push({name: currentName, status: 'JOINED'});

  // Keydown listeners
  $('#message').keypress(function(e) {
    if (e.keyCode == 13) {
      var name = $('#name').val();
      var text = $('#message').val();
      if (text === '/clear') {
        $('#clear').trigger('click');
        $('#message').val('');
        return;
      }
      messagesRef.push({name: name, text: text, ts: Firebase.ServerValue.TIMESTAMP});
      $('#message').val('');

      $('#message').attr('disabled', true);
      setTimeout(function() {
        $('#message').removeAttr('disabled');
        $('#message').focus();
      }, 100);
    }
  });
  $('#message').focus();

  $('#name').change(function() {
    var oldName = currentName;
    currentName = $('#name').val();
    messagesRef.push({name: oldName, newname: currentName, status: 'NAMECHANGE'});
    localStorage['preferredName'] = currentName;
  });

  $('#room').keypress(function(e) {
    if (e.keyCode == 13) {
      window.location.href = '?r=' + $('#room').val();
    }
  });

  // Other listeners
  $(window).bind('beforeunload', function() {
    messagesRef.push({name: currentName, status: 'QUIT'});
  });

  // Rap buttons
  STICKERS.forEach(function(sticker) {
    var display = sticker.audio.slice(5, sticker.audio.indexOf('.'));
    $('<button>').text(display).data('slug', sticker.slug).appendTo($('#rapbuttons'));
  });


  $('#rapbuttons button').on('click', function() {
    var name = $('#name').val();
    messagesRef.push({
      name: name,
      sticker: $(this).text(),
      slug: $(this).data('slug'),
      ts: Firebase.ServerValue.TIMESTAMP
    });

    $('#rapbuttons button').attr('disabled', true);
    setTimeout(function() {
      $('#rapbuttons button').removeAttr('disabled');
    }, 650);
  });

  $('#clear').on('click', function() {
    messagesRef.remove();
    $('#messages').empty();
  });

  $('#changeRoom').on('click', function() {
    var newRoom = prompt('Where to?', room);
    if (newRoom && newRoom !== room) {
      window.location.href = '?r=' + newRoom;
    }
  });

  // Firebase and chat stuff
  messagesRef.endAt().limit(MESSAGE_LIMIT).on('child_added', function(snapshot) {
    var message = snapshot.val();
    var partOfHistory = false;
    if (message.ts < new Date().getTime() - BACK_HISTORY_MS) {
      return;
    } else if (message.ts < new Date().getTime() - 5000) {
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
  });

  function newMessage(name, text) {
    $('<p>').text(name + ': ' + text).appendTo($('#messages'));
  }

  function newAction(name, text) {
    $('<p>').text(name + ' ' + text).appendTo($('#messages'));
  }

  function newSticker(name, sticker, slug, noPlay) {
    var audio = $('<audio>');
    $('<source>').attr('src', 'oggs/' + sticker + '.ogg')
      .attr('type', 'audio/ogg').appendTo(audio);
    $('<source>').attr('src', 'mp3s/' + sticker + '.mp3')
      .attr('type', 'audio/mp3').appendTo(audio);
    $('#messages').append(audio);

    var sticker = $('<div class="sticker artists-' + slug + '"></div>');
    $('<p>').append(name + ':').append(sticker).appendTo($('#messages'));

    if (!noPlay) {
      audio[0].play();
    }

    sticker.on('click', function() {
      audio[0].play();
    });
  }

  // User list/presence stuff
  // TODO list nicks
  // see https://www.firebase.com/blog/2013-06-17-howto-build-a-presence-system.html
  var listRef = new Firebase(BASE_FIREBASE_URL + 'presence/');
  var userRef = listRef.push();

  // Add ourselves to presence list when online.
  var presenceRef = new Firebase(BASE_FIREBASE_URL + '.info/connected');
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
    snap.forEach(function(userPresenceSnap) {
      var userPresence = userPresenceSnap.val();
      if (userPresence.name) {
        onlines.push(userPresence.name);
      } else {
        onlines.push('?');
      }
    });
    $('#onlineList').text(onlines.join(', '));
  });
});

function getQueryParam(name) {
  name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
  results = regex.exec(location.search);
  return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function scrollDown() {
  $('#messages')[0].scrollTop = $('#messages')[0].scrollHeight;
}
