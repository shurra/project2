const myStorage = window.localStorage;

document.addEventListener('DOMContentLoaded', () => {
//Templates for channel in channels list and user in users list
    var channel_list_item = Handlebars.compile(document.querySelector('#channel_list_item').innerHTML);
    var users_list_item = Handlebars.compile(document.querySelector('#users_list_item').innerHTML);
    var messages_list_item = Handlebars.compile(document.querySelector('#messages_list_item').innerHTML);
    // Connect to websocket
    var socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);

    //If user not in local storage, open login form:
    if(!myStorage.getItem('username') || myStorage.getItem('username') === "") {
        //Listener for Login button
        const loginForm = document.querySelector('#loginForm').querySelector('form');
        loginForm.onsubmit = (e) => {
            var formData = new FormData(e.target);
            const new_user = formData.get('username').trim();
            if (new_user && new_user !== "") {
                myStorage.setItem('username', new_user);
                myStorage.setItem('gender', formData.get('gender'));
                document.querySelector('.footer_username').innerHTML = new_user;
                //set avatar
                if (localStorage.getItem('gender') === "male") {
                    document.querySelector('.footer').querySelector('.profile-pic').style.backgroundImage = 'url("/static/img/avatar_m.png")';
                } else {
                    document.querySelector('.footer').querySelector('.profile-pic').style.backgroundImage = 'url("/static/img/avatar_f.png")';
                }

                // close Login Form
                document.querySelector('#loginForm').style.display = 'none';
            }
            else alert("Please enter your name");
            return false
        };
        //Show login form
        document.querySelector('#loginForm').style.display = 'block';
    } else {
        document.querySelector('#loginForm').style.display = 'none';
        document.querySelector('.footer_username').innerHTML = myStorage.getItem('username');
        //set avatar
        if (localStorage.getItem('gender') === "male") {
            document.querySelector('.footer').querySelector('.profile-pic').style.backgroundImage = "url(/static/img/avatar_m.png)";
        } else {
            document.querySelector('.footer').querySelector('.profile-pic').style.backgroundImage = "url(/static/img/avatar_f.png)";
        }
    }

    // When connected, configure buttons
    socket.on('connect', () => {
        // new channel button
        const new_channel_form = document.querySelector('#new_channel');
        new_channel_form.addEventListener('submit', (e) => {
            e.preventDefault();
            var c_name = new_channel_form.querySelector('input').value.trim();
            // if(!c_name.match(/^[0-9a-zA-Z]{1,16}$/)) {
            //     alert('Illegal channel name. Only alphanumeric symbols allowed (max 16).');
            // }
            if (c_name) {
                socket.emit('new channel', {'c_name': c_name});
                //join that channel after creation
                join_channel(c_name);
            }
            new_channel_form.querySelector('input').value = "";
            return false
        });

        //disable message input before join
        document.querySelector(".input-box_text").disabled = true;
        //join saved channel after page load
        if (myStorage.getItem('current_channel') && myStorage.getItem('username')) {
            join_channel(myStorage.getItem('current_channel'));
        }
        document.querySelector('.connection_status').innerHTML = "online";
        document.querySelector('.connection_status').style.color = "white";
    });

    socket.on('disconnect', () => {
        document.querySelector('.connection_status').innerHTML = "offline";
        document.querySelector('.connection_status').style.color = "red";
    });
    //Receive channels update
    socket.on('channels', (data) => {
        channels_list(data);
    });
    //Receive users update
    socket.on('users', (data) => {
        document.querySelector('#users_list').innerHTML = users_list_item({'users': data});
    });

    //Receive channels messages on joining channel
    socket.on('messages', (data) =>{
        // console.log("messages received", data);
        // messages_list(data);
        const messages_list = document.querySelector('#messages');
        messages_list.innerHTML = messages_list_item({'messages': data});
        messages_list.scrollTop = messages_list.scrollHeight;
        del_message_button();
    });

    //Receive message (post) in joined channel
    socket.on('post', (data) => {
        document.getElementById('message_sound').play();
        const message_container = document.querySelector('#messages');
        message_container.innerHTML += messages_list_item({'messages': [data]});
        message_container.scrollTop = message_container.scrollHeight;
        del_message_button();
    });

    //Remove message from list on 'message deleted'
    socket.on('message deleted', (data) => {
        const messages_container = document.querySelector('#messages');
        messages_container.querySelectorAll('.message').forEach((element) => {
            if (element.querySelector('.message_username').innerHTML === data['user'] &&
                element.querySelector('.message_timestamp').innerHTML === data['time'] &&
                element.querySelector('.message_content').innerHTML === data['text']
            ) {
                element.style.animationPlayState = 'running';
                element.addEventListener('animationend', () =>  {
                    element.remove();
                });
            }
        });
    });

    function channels_list(channels) {
        document.querySelector('#channels_list').innerHTML = channel_list_item({'channels': channels});
        //Listeners for channels names
        document.querySelector('#channels_list').querySelectorAll('li').forEach((item) => {
            item.addEventListener('click', () => {
                if (myStorage.getItem('current_channel') === item.dataset.chname) {
                    return null
                }
                join_channel(item.dataset.chname);
                document.querySelector('#channels_list').querySelectorAll('li').forEach((item) => {
                    item.classList.remove('active');
                });
                item.classList.add('active');
            });
            if (item.dataset.chname === myStorage.getItem('current_channel')) {
                item.classList.add('active');
            }
        })
    }

    function join_channel(channel) {
        // Leave current channel, if joined
        if (myStorage.getItem('current_channel')) {
            socket.emit('leave', {room: myStorage.getItem('current_channel'), user: myStorage.getItem('username')});
        }
        myStorage.setItem('current_channel', channel);
        socket.emit('join', {room: channel, user: myStorage.getItem('username'), gender: myStorage.getItem('gender')});
        // message input
        var message_input = document.querySelector('.input-box_text');
        message_input.disabled = false;
        message_input.addEventListener('keyup', (event) => {
            if (event.key === "Enter" && message_input.value.length > 0) {
                var current_date = new Date;
                var time = addZero(current_date.getHours()) + ":" + addZero(current_date.getMinutes()) + ":" + addZero(current_date.getSeconds());
                var pic_url;
                if (myStorage.getItem('gender') === "male"){
                    pic_url = "static/img/avatar_m.png";
                } else {
                    pic_url = "static/img/avatar_f.png";
                }
                socket.emit('send post', {room: myStorage.getItem('current_channel'), user: myStorage.getItem('username'), time: time, text: message_input.value, pic_url: pic_url});
                message_input.value = "";
            }
        });
        document.querySelector('.channel-menu_name').innerHTML = "# " + channel;
    }

    function addZero(i) {
        if (i < 10) {
            i = "0" + i;
        }
        return i;
    }

    function del_message_button() {
        document.querySelectorAll('.del_message').forEach((item) => {
            item.addEventListener('click', event => {
                const item = event.target.parentElement;
                item.style.animationPlayState = 'running';
                item.addEventListener('animationend', () =>  {
                    item.remove();
                });
                var message = {"user": item.querySelector('.message_username').innerHTML,
                    "time": item.querySelector('.message_timestamp').innerHTML,
                    "text": item.querySelector('.message_content').innerHTML,
                    "pic_url": item.querySelector('.profile-pic').getAttribute('src')
                };
                socket.emit('del message', {channel: localStorage.getItem('current_channel'),
                    message: message}, room=localStorage.getItem('current_channel'));
            });
        });
    }

    Handlebars.registerHelper('del_button', function(user) {
        if (user === localStorage.getItem('username')) {
            return new Handlebars.SafeString('<button class="btn btn-danger btn-xs del_message">x</button>');
        }
    });


});
