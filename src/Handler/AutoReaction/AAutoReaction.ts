import {IAutoReaction} from "./IAutoReaction";
import {Message} from "discord.js";
import {CustomClient} from "../../Client/CustomClient";

export abstract class AAutoReaction implements IAutoReaction{
    readonly abstract description: string;
    readonly abstract name: string;
    readonly cooldown: number = 1;
    aliases: string[] = []; // Can be an array of strings with aliases for this auto reaction

    abstract execute(message: Message): Promise<void>;

    setup(client: CustomClient): Promise<IAutoReaction> {
        return Promise.resolve(this);
    }
}