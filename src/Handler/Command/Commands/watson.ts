import {callAssistant} from "../../../Watson/Watson";
import { Message } from "discord.js";
import {ACommand} from "../ACommand";
import {ASSISTANT_CHANNEL_ID} from "../../../Data/Config/Config";
import {Keys} from "../../../Data/Keys";
export default class Watson extends ACommand  {
    name = 'watson';
    description = 'AI assistant';
    usage = '[Tekst die je aan IBM\'s Watson Assistant wil meegeven.]';
    aliases = ['w'];
    cooldown = 1;
    bypassChannelIdKey = Keys.Guild.assistantChannelId;
    hidden = true;
    execute(message: Message, args: string[]) {
        let text = args.join(' ');
        const author = message.author.toString();
        callAssistant(text).then((txt: string) => {
            txt = txt.replace('{user}', `${author}`);
            message.channel.send(txt).then();
        }).catch(console.log);
    }
}