$(function() {
  var firebase = new Firebase('https://kqw8tijfs91.firebaseio-demo.com/');

  $('#message').keypress(function (e) {
    if (e.keyCode == 13) {
      var name = $('#name').val();
      var text = $('#message').val();
      firebase.push({name: name, text: text});
      $('#message').val('');
    }
  });

  $('#rapbuttons input[type="button"]').on('click', function() {
    firebase.push({name: name, sticker: $(this).val()});
  });

  firebase.on('child_added', function(snapshot) {
    var message = snapshot.val();
    console.log(message);
    if (message.sticker) {
      newSticker(message.sticker);
    } else {
      newMessage(message.name, message.text);
    }
  });

  function newMessage(name, text) {
    $('<p>').text(name + ': ' + text).appendTo($('#messages'));
    $('#messages')[0].scrollTop = $('#messages')[0].scrollHeight;
  }

  function newSticker(sticker) {
    var audio = $('<audio>');
    $('<source>').attr('src', 'oggs/' + sticker + '.ogg').appendTo(audio);
    $('#messages').append(audio);

    $('<p>').html('<em>(' + sticker + ')</em>').appendTo($('#messages'));
    $('#messages')[0].scrollTop = $('#messages')[0].scrollHeight;

    audio[0].play();
  }
});
