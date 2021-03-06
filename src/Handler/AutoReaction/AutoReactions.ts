import {CustomClient} from "../../Client/CustomClient";
import fs from "fs";
import {IAutoReaction} from "./IAutoReaction";
import {Collection, Message} from "discord.js";
import {AAutoReaction} from "./AAutoReaction";
import {Messages} from "../../Util/Messages";
import {LOG} from "../../Util/Log";
import {IEventHandler} from "../IEventHandler";
import {Keys} from "../../Data/Keys";

export class AutoReactions implements IEventHandler {
    readonly client: CustomClient;
    readonly autoReactions = new Collection<string, IAutoReaction>();
    readonly cooldowns = new Collection<string, Collection<string, number>>();
    readonly triggerWords: string[] = [];

    constructor(client: CustomClient) {
        this.client = client;
        this.setup(client);
    }

    private setup(client: CustomClient){
        const autoReactionFiles = fs.readdirSync('./src/Handler/AutoReaction/AutoReactions').filter((file: string) => file.endsWith('.ts'));
        for (const file of autoReactionFiles) {
            import(`./AutoReactions/${file}`)
                .then(({default: autoReaction}) => {
                    const ar: IAutoReaction = new autoReaction();
                    return ar.setup(client)
                }).then(reaction => {
                    this.addAutoReaction(reaction);
                }).catch(console.log);
        }
    }

    private addAutoReaction(reaction: IAutoReaction) {
        this.autoReactions.set(reaction.name, reaction);

        if (!this.triggerWords.some(v => v.includes(reaction.name))){
            this.triggerWords.push(reaction.name);
        }
        reaction.aliases
            .filter(alias => !this.triggerWords.some(v => v.includes(alias)))
            .forEach(alias => this.triggerWords.push(alias));
    }

    public reload(){
        this.triggerWords.length = 0;
        const oldAutoReactions = this.autoReactions.clone();
        this.autoReactions.clear();
        oldAutoReactions.forEach(this.addAutoReaction);
    }

    public handleMessage(message: Message): Promise<void> {
        if (message.guild){
            if (message.client instanceof CustomClient) {
                const guildData = message.client.data.guilds.get(message.guild.id);
                if (guildData.TRIGGERS !== 'true' || message.channel.id === guildData.LOG_CHANNEL_ID) return Promise.resolve();
                const statusChannelId = message.client.data.settings.get(Keys.Settings.statusChannelId);
                if (message.channel.id == statusChannelId) return Promise.resolve();
            } else {
                return Promise.resolve();
            }
        }

        return Messages.parse(message)
            .then(parsedContent => {
                if (this.triggerWords.some(triggerWord => parsedContent.includes(triggerWord))){
                    return this.autoReactions
                        .filter((v,k) => parsedContent.includes(k) || v.aliases.some(alias => parsedContent.includes(alias)))
                        .array();
                }
                return [];
            }).then(triggered => {
                triggered.forEach((reaction: IAutoReaction) => {
                    this.executeReaction(reaction, message).then();
                })
            });
    }

    public executeReaction(reaction: IAutoReaction, message: Message): Promise<Message> {
        if (reaction.cooldown > 0) {
            if (!this.cooldowns.has(reaction.name)) {
                this.cooldowns.set(reaction.name, new Collection<string, number>());
            }

            const now = Date.now();
            const timestamps = this.cooldowns.get(reaction.name);
            const cooldownAmount = (reaction.cooldown || 3) * 1000;

            // @ts-ignore
            if (timestamps.has(message.author.id)) {
                // @ts-ignore
                const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

                if (now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    //return message.reply(`Please wait ${timeLeft.toFixed(1)} more second(s) before reusing the \`${reaction.name}\` trigger.`);
                    return LOG.sendToLogChannel(this.client,`Due to a cooldown \'${reaction.name}\' did not run for: ${message.url}`, false, message.channel)
                }
            } else {
                // @ts-ignore
                timestamps.set(message.author.id, now);
                // @ts-ignore
                setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);
            }
        }

        return reaction.execute(message)
            .then(() => LOG.sendToLogChannel(this.client,`Ran ${reaction.name} for: ${message.url}`, false, message.channel))
            .catch(error => LOG.sendToLogChannel(this.client, error, false, message.channel));
    }

}