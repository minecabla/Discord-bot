// Run dotenv
require('dotenv').config();

const fs = require('fs');
const fetch = require('node-fetch');
const Discord = require('discord.js');
const config = require('./config.json');
const prefix = config.prefix;
const client = new Discord.Client();
const escapeRegex = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

client.autoReactions = new Discord.Collection();
const autoReactionFiles = fs.readdirSync('./auto-reactions').filter(file => file.endsWith('.js'));
for (const file of autoReactionFiles) {
    const autoReaction = require(`./auto-reactions/${file}`);
    client.autoReactions.set(autoReaction.name, autoReaction);
}

client.commands = new Discord.Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);
}

const cooldowns = new Discord.Collection();

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});


client.on('message', message => {
    addReactions(message);
    executeCommand(message);
});

client.login(process.env.DISCORD_TOKEN);

function addReactions(message) {
    let messageContentLowerCase = message.content.toLowerCase();
    if (client.autoReactions.some(autoReaction => messageContentLowerCase.includes(autoReaction.name) || (autoReaction.aliases && messageContentLowerCase.includes(autoReaction.aliases)))) {
        for(const autoReaction of client.autoReactions.values()){
            if ((messageContentLowerCase.includes(autoReaction.name) || (autoReaction.aliases && messageContentLowerCase.includes(autoReaction.aliases))) && !message.content.includes(`:${autoReaction.name}:`)) {
                try {
                    autoReaction.execute(message);
                } catch (error) {
                    console.error(error);
                }
            }
        }
    }
}

function executeCommand(message){
    const prefixRegex = new RegExp(`^(<@!?${client.user.id}>|${escapeRegex(prefix)})\\s*`);
    if (!prefixRegex.test(message.content) || message.author.bot) return;

    const [, matchedPrefix] = message.content.match(prefixRegex);
    const args = message.content.slice(matchedPrefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
    if (!command) return;

    if (command.guildOnly && message.channel.type === 'dm') {
        return message.reply('I can\'t execute that command inside DMs!');
    }

    if (command.args && !args.length) {
        let reply = `You didn't provide any arguments, ${message.author}!`;
        if (command.usage) {
            reply += `\nThe proper usage would be: \`${prefix}${command.name} ${command.usage}\``;
        }
        return message.channel.send(reply);
    }

    if (!cooldowns.has(command.name)) {
        cooldowns.set(command.name, new Discord.Collection());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(command.name);
    const cooldownAmount = (command.cooldown || 3) * 1000;

    if (timestamps.has(message.author.id)) {
        const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return message.reply(`Please wait ${timeLeft.toFixed(1)} more second(s) before reusing the \`${command.name}\` command.`);
        }
    } else {
        timestamps.set(message.author.id, now);
        setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);
    }

    try {
        command.execute(message, args);
    } catch (error) {
        console.error(error);
        message.reply('There was an error trying to execute that command!');
    }
}