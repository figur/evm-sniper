import blessed from 'blessed';
const { setLabel } = blessed.element.prototype;
import until from './spinner.js';
import { scroll, throttle } from './blessed/scroll.js';
import { log } from '../promise.js';

function itemUI(label) {
    const box = blessed.box({
        top: 'center',
        left: 'center',
        width: '50%',
        height: '50%',
        label: label,
        border: 'line',
        style: {
            label: { bold: true },
        },
    });

    const list = blessed.with(scroll, throttle).list({
        parent: box,
        height: 'shrink',
        bottom: 0,
        align: 'left',
        top: 4,
        width: '100%',
        keys: true,
        tags: true,
        mouse: true,
        border: 'line',
        invertSelected: false,
        scrollbar: {
            ch: ' ',
            style: { bg: 'white' },
            track: {
                style: { bg: 'grey' },
            },
        },
        style: {
            label: { bold: true },
            selected: { bold: true, fg: 'black', bg: 'white' },
        },
    });

    blessed.text({
        parent: box,
        left: 2,
        top: 2,
        align: 'left',
        content: 'Filter:',
    });

    const search = blessed.textbox({
        parent: box,
        border: 'line',
        width: '100%-11',
        height: 3,
        top: 1,
        right: 1,
        inputOnFocus: true,
    });

    search.options.inputOnFocus = false;

    return { search, box, list };
}

export default function itemPrompt(screen, getItemList, getItemByName, label, { current_item, promptAfterRequest } = { promptAfterRequest: false }) {
    return new Promise(function (fulfill, reject) {
        const { search, box, list } = itemUI(label);
        let itemsList = [], message;

        function updateList() {
            const tokens = search.value.split(/\s+/).filter(w => w);
            let items = (itemsList.items || [])
                .filter(c => tokens.every(token => c.name.includes(token)))
                .map(c => {
                    const item = c.name;
                    if (search.value.length === 0) {
                        if (c.name === current_item) {
                            return `{blue-fg}${item}{/blue-fg}`;
                        }
                        return item;
                    }
                    const matches = Buffer.alloc(item.length);
                    tokens.forEach(token => {
                        const regex = new RegExp(token, 'g');
                        let match;
                        while ((match = regex.exec(item)) !== null) {
                            matches.fill(1, match.index, match.index + token.length);
                        }
                    });
                    let res = '', index = 0, match = false;
                    for (let i = 0; i < matches.length; i++) {
                        const m = matches.readUInt8(i) > 0;
                        if (match == m) continue;
                        res += item.substring(index, i);
                        res += m ? '{yellow-fg}' : '{/yellow-fg}';
                        index = i;
                        match = m;
                    }
                    res += item.substring(index);
                    if (item === current_item) {
                        res = `{blue-fg}${res}{/blue-fg}`;
                    }
                    return res;
                });
            list.setItems(items);
        }

        async function getItems() {
            let result = getItemList();
            if (!result) {
                return { items: [] };
            }
            if (!result.items) {
                return { items: result };
            }
            return result;
        }

        function request_items() {
            return (getItems())
                .then(result => {
                    itemsList = result;
                    if (itemsList.items.length === 0) {
                        list_message('No available items');
                    } else {
                        updateList();
                        if (current_item) {
                            const selected = itemsList.items
                                .filter(c => c.name.includes(search.value))
                                .findIndex(c_1 => c_1.name === current_item);
                            list.select(selected);
                            if (selected > list.height / 2 - 1) {
                                list.childOffset += list.height / 2 - 1 | 0;
                                list.scrollTo(selected);
                            }
                        }
                        screen.render();
                    }
                })
        }

        function prompt_itemsUI() {
            screen.saveFocus();
            screen.grabKeys = true;
            screen.grabMouse = true;
            screen.append(box);
            list.grabMouse = true;
            screen.render();
            search.focus();
        }

        function close_itemsUI() {
            box.destroy();
            screen.restoreFocus();
            screen.grabKeys = false;
            screen.grabMouse = false;
            screen.render();
        }

        function list_message(text, options = {}) {
            if (message) message.destroy();
            message = blessed.text(Object.assign({
                parent: box,
                tags: true,
                top: 'center',
                left: 'center',
                content: text,
            }, options));
        }

        search.__oolistener = search._listener;
        search._listener = function (ch, key) {
            if (['up', 'down', 'pageup', 'pagedown', 'enter'].includes(key.name)) {
                return list.emit('keypress', ch, key);
            }
            const ret = this.__oolistener(ch, key);
            if ('escape' === key.name) {
                close_itemsUI();
                fulfill(current_chain);
                return ret;
            }
            updateList();
            screen.render();
            return ret;
        };

        list.on('select', item => {
            if (item) {
                close_itemsUI();
                const itemName = blessed.helpers.cleanTags(item.getContent());
                const selectedItem = getItemByName(itemName);
                if (selectedItem) {
                    fulfill(selectedItem);
                } else {
                    reject(new Error(`Could not find item with name ${itemName}`));
                }
            }
        });

        if (promptAfterRequest) {
            request_items()
                .then(prompt_itemsUI)
                .catch(error => reject(error));
        } else {
            prompt_itemsUI();
            until(request_items())
                .do(box, setLabel).spin(s => `${s} ${label}`).done(_ => label)
                .catch(error => {
                    log(`{red-fg}Error: ${error.message}{/red-fg}`);
                    // console.error(error.stack);
                    screen.render();
                });
        }
    });
}
