import { IUser } from "../types";
import { User } from "./User";

export class ClientUser extends User {

    constructor(data: IUser) {
        super(data);
    }
}