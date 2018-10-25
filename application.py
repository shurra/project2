import os

from flask import Flask, render_template
from flask_socketio import SocketIO, emit, join_room, leave_room

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
socketio = SocketIO(app)


channels = set()
online_users = []
channels_list = []


@app.route("/")
def index():
    return render_template("index.html")


@socketio.on("connect")
def on_connect():
    emit('channels', [c.name for c in channels], broadcast=True)


@socketio.on("new channel")
def new_channel(data):
    if data['c_name'] not in [c.name for c in channels]:
        channel = Channel(data['c_name'])
        channels.add(channel)
        emit('channels', [c.name for c in channels], broadcast=True)


@socketio.on('join')
def on_join(data):
    username = data['user']
    user_gender = data['gender']
    room = data['room']
    if user_gender == "male":
        pic_url = "static/img/avatar_m.png"
    else:
        pic_url = "static/img/avatar_f.png"
    # Create channel, if no exist
    if room not in [c.name for c in channels]:
        new_channel({'c_name': room})
    join_room(room)
    channel = find(channels, room)
    channel.add_user(username, user_gender, pic_url)
    emit('users', channel.users, room=room)
    emit('messages', channel.messages, room=room)


@socketio.on('leave')
def on_leave(data):
    username = data['user']
    room = data['room']
    leave_room(room)
    channel = find(channels, room)
    if channel:
        if username in [u['username'] for u in channel.users]:
            channel.del_user(username)
            emit('users', channel.users, room=room)


@socketio.on('send post')
def on_send_post(data):
    channel = find(channels, data['room'])
    channel.add_message({"user": data['user'], "time": data['time'], "text": data['text'], "pic_url": data['pic_url']})
    emit('post', {"user": data['user'],
                  "time": data['time'],
                  "text": data['text'],
                  "pic_url": data['pic_url']
                  },
         room=data['room'])


@socketio.on('del message')
def on_del_message(data, room):
    channel = find(channels, data['channel'])
    channel.del_message(data['message'])
    emit('message deleted', data['message'], room=room)


class Channel:
    """Class for channels"""

    def __init__(self, name):
        self.name = name
        # self.messages = [{"user": "admin", "time": "00:00", "text": f"Welcome to the {self.name}"}]
        self.messages = []
        self.users = []

    def add_message(self, message):
        self.messages.append(message)
        if len(self.messages) > 100:
            self.messages.pop(0)

    def del_message(self, message):
        if message in self.messages:
            self.messages.remove(message)

    def add_user(self, username, user_g, pic_url):
        user_data = {"username": username, "user_g": user_g, "pic_url": pic_url}
        if user_data not in self.users:
            # self.users.append({"username": username, "user_g": user_g})
            self.users.append(user_data)

    def del_user(self, username):
        user_data = [item for item in self.users if item["username"] == username].pop(0)
        self.users.remove(user_data)

    def __str__(self):
        return f"Channel name: {self.name}, joined users: {self.users}, messages: {self.messages}"


def find(_list, value):
    """Return channel object with property name == value"""
    for item in _list:
        if item.name == value:
            return item
