module.exports = {
    name: 'ping',
    description: 'Ping!',
    args: true,
    usage: false, // Can be a string with an explanation of the required arguments
    execute(message, args) {
        message.channel.send('Pong!');
    },
};