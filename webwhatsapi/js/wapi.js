/**
 * This script contains WAPI functions that need to be run in the context of the webpage
 */


window.WAPI = {
    lastRead: {}
};


/**
 * Serializes a chat object
 *
 * @param rawChat Chat object
 * @returns {{}}
 */
window.WAPI.serializeChat = function (rawChat) {
    let chat = {};

    let name = null;
    if (rawChat.__x_name !== undefined) {
        name = rawChat.__x_name;
    } else {
        if (rawChat.__x_formattedName !== undefined) {
            name = rawChat.__x_formattedName;
        } else {
            if (rawChat.__x_formattedTitle !== undefined) {
                name = rawChat.__x_formattedTitle;
            }
        }
    }
    chat = rawChat.all;
    chat.name = name;
    chat.id = rawChat.__x_id;
    chat.isGroup = rawChat.isGroup;
    return chat;
};

window.WAPI._serializeRawObj = (obj) => {
    return obj.all;
}
/**
 * Fetches all contact objects from store
 *
 * @param done Optional callback function for async execution
 * @returns {Array|*} List of contacts
 */
window.WAPI.getAllContacts = function (done) {
    const contacts = Store.Contact.models.map((contact) => contact.all);

    if (done !== undefined) {
        done(contacts);
    } else {
        return contacts;
    }
};

/**
 * Fetches contact object from store by ID
 *
 * @param id ID of contact
 * @param done Optional callback function for async execution
 * @returns {T|*} Contact object
 */
window.WAPI.getContact = function(id, done) {
    const found = Store.Contact.models.find((contact) => contact.id === id);

    if (done !== undefined) {
        done(found.all);
    } else {
        return found.all;
    }
};

/**
 * Fetches all chat objects from store
 *
 * @param done Optional callback function for async execution
 * @returns {Array|*} List of chats
 */
window.WAPI.getAllChats = function (done) {
    const chats = Store.Chat.models.map((chat) => chat.all);

    if (done !== undefined) {
        done(chats);
    } else {
        return chats;
    }
};

/**
 * Fetches chat object from store by ID
 *
 * @param id ID of chat
 * @param done Optional callback function for async execution
 * @returns {T|*} Chat object
 */
window.WAPI.getChat = function(id, done) {
    const found = Store.Chat.models.find((chat) => chat.id === id);

    if (done !== undefined) {
        done(found.all);
    } else {
        return found.all;
    }
};

/**
 * Fetches all group metadata objects from store
 *
 * @param done Optional callback function for async execution
 * @returns {Array|*} List of group metadata
 */
window.WAPI.getAllGroupMetadata = function(done) {
    const groupData = Store.GroupMetadata.models.map((groupData) => groupData.all);

    if (done !== undefined) {
        done(groupData);
    } else {
        return groupData;
    }
};

/**
 * Fetches group metadata object from store by ID
 *
 * @param id ID of group
 * @param done Optional callback function for async execution
 * @returns {T|*} Group metadata object
 */
window.WAPI.getGroupMetadata = async function(id, done) {
    let found = Store.GroupMetadata.models.find((groupData) => groupData.id === id);

    if (found !== undefined) {
        if (found.stale) {
            await found.update();
        }
    }

    if (done !== undefined) {
        done(found);
    } else {
        return found;
    }
};

/**
 * Fetches group participants
 *
 * @param id ID of group
 * @returns {Promise.<*>} Yields group metadata
 * @private
 */
window.WAPI._getGroupParticipants = async function(id) {
    const metadata = await WAPI.getGroupMetadata(id);
    return metadata.participants;
};

/**
 * Fetches IDs of group participants
 *
 * @param id ID of group
 * @param done Optional callback function for async execution
 * @returns {Promise.<Array|*>} Yields list of IDs
 */
window.WAPI.getGroupParticipantIDs = async function(id, done) {
    const participants = await WAPI._getGroupParticipants(id);

    const ids = participants.map((participant) => participant.id);

    if (done !== undefined) {
        done(ids);
    } else {
        return ids;
    }
};

window.WAPI.getGroupAdmins = async function(id) {
    const participants = await WAPI._getGroupParticipants(id);
    return participants
        .filter((participant) => participant.isAdmin)
        .map((admin) => admin.id);
};

/**
 * Gets object representing the logged in user
 *
 * @returns {Array|*|$q.all}
 */
window.WAPI.getMe = function () {
    const contacts = window.Store.Contact.models;

    const rawMe = contacts.find((contact) => contact.all.isMe, contacts);

    return rawMe.all;
};


// FUNCTIONS UNDER THIS LINE ARE UNSTABLE

window.WAPI.getAllMessagesInChat = function (id, includeMe) {
    const chat = WAPI._getChat(id);

    let output = [];

    const messages = chat.msgs.models;
    for (const i in messages) {
        if (i === "remove") {
            continue;
        }

        const messageObj = messages[i];

        if (messageObj.__x_isNotification) {
            // System message
            // (i.e. "Messages you send to this chat and calls are now secured with end-to-end encryption...")
            continue;
        }

        if (messageObj.id.fromMe === false || includeMe) {
            let message = WAPI._serializeRawObj(messageObj);

            output.push(message);
        }
    }

    WAPI.lastRead[chat.__x_formattedTitle] = Math.floor(Date.now() / 1000);

    return output;
};

window.WAPI.sendMessage = function (id, message) {
    const Chats = Store.Chat.models;

    for (const chat in Chats) {
        if (isNaN(chat)) {
            continue;
        }

        let temp = {};
        temp.name = Chats[chat].__x__formattedTitle;
        temp.id = Chats[chat].__x_id;
        if (temp.id === id) {
            Chats[chat].sendMessage(message);

            return true;
        }
    }

    return false;
};

function isChatMessage(message) {
    if (message.__x_isSentByMe) {
        return false;
    }
    if (message.__x_isNotification) {
        return false;
    }
    if (!message.__x_isUserCreatedType) {
        return false;
    }
    return true;
}


window.WAPI.getUnreadMessages = function () {
    const chats = Store.Chat.models;
    let output = [];
    for (let chat in chats) {
        if (isNaN(chat)) {
            continue;
        }

        let messageGroupObj = chats[chat];

        let messageGroup = WAPI.serializeChat(messageGroupObj);
        messageGroup.messages = [];

        const messages = messageGroupObj.msgs.models;
        for (let i = messages.length - 1; i >= 0; i--) {
            let messageObj = messages[i];
            if (!messageObj.__x_isNewMsg) {
                break;
            } else {
                if (!isChatMessage(messageObj)) {
                    continue;
                }
                messageObj.__x_isNewMsg = false;
                console.log(messageObj);
                messageGroup.messages.push(WAPI._serializeRawObj(messageObj));
            }
        }

        if (messageGroup.messages.length > 0) {
            output.push(messageGroup);
        }
    }
    console.log("OUTPUT-----------------");
    console.log(output);
    return output;
};

window.WAPI.getCommonGroups = function(id) {
    // return
};

window.WAPI.getGroupOwnerID = async function(id) {
    return WAPI.getGroupMetadata(id).owner.id;
};