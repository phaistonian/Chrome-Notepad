// todo add google analytics
var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-91030790-1']);
_gaq.push(['_trackPageview']);

(function() {
    var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
    ga.src = 'https://ssl.google-analytics.com/ga.js';
    var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();

const NEW = "NEW";
var BOOKMARK_NAME = "CuteNotepad";
var TRASH_BOOKMARK_NAME = "trashedNotes";
var SUBSTRING_END_INDEX = 15;
const RECENTLY_UPDATED_COUNT = 4;
var Model = {
    bookmarkData: {}
};

var ContextMenuBuilder = function () {
    var ContextMenuBuilderInstance;
    // active notes
    var notes = [];

    function setUpContextMenus() {
        chrome.contextMenus.removeAll();
        chrome.contextMenus.create({
            id: NEW,
            title: "Create into a new note",
            contexts:["selection"]
        });
        for (var i = 0; i < notes.length; i++) {
            if (i > RECENTLY_UPDATED_COUNT) break;
            chrome.contextMenus.create({
                id: notes[i].id,
                title: "Add to " + notes[i].title,
                contexts:["selection"]
            });
        }
        chrome.contextMenus.onClicked.addListener(updateNoteFromContextMenu);
    }

    function updateNoteFromContextMenu(itemData) {
        if (itemData.menuItemId === NEW) {
            createNewNote(itemData);
            _gaq.push(['_trackEvent', "ContextMenu", 'clicked', "New"]);
        } else {
            var note = notes.filter(function(note) {
                return note.id === itemData.menuItemId;
            });
            if (note.length === 1) {
                var content = note[0].url.replace("data:text/plain;charset=UTF-8,", "");
                content = decodeURIComponent(content) + getNewContent(itemData);
                chrome.bookmarks.update(note[0].id, {
                    title: getTitleFromContent(content),
                    url: "data:text/plain;charset=UTF-8," + encodePercentSymbol(content)
                }, updatedNote => {
                    _gaq.push(['_trackEvent', "ContextMenu", 'clicked', "Existing"]);
                    const index = notes.findIndex(note => note.id === updatedNote.id);
                    notes.splice(index, 1);
                    notes.unshift(updatedNote);
                    setUpContextMenus();
                });
            } else {
                // very unlikely todo log
            }
        }
    }

    function getTitleFromContent(content) {
        var d = document.createElement('div');
        d.innerHTML = content;
        return d.textContent.trim().substring(0, SUBSTRING_END_INDEX) || "New Note";
    }

    function encodePercentSymbol(str) {
        return str.replace(/%/g, "%25");
    }

    /**
     * when we select 'add to a new note' in contextmenu
     * @param itemData
     */
    function createNewNote(itemData) {
        var newContent = getNewContent(itemData);
        chrome.bookmarks.create({
            parentId: Model.bookmarkData.id,
            title: getTitleFromContent(itemData.selectionText),
            url: "data:text/plain;charset=UTF-8," + encodePercentSymbol(newContent)
        }, function(bookmarkNode) { // new note
            // todo track context menu used to add to new view
            notes.unshift(bookmarkNode);
            setUpContextMenus();
        });
    }

    function getSource(itemData) {
        return itemData.pageUrl ? itemData.pageUrl : itemData.frameUrl;
    }

    function getNewContent(itemData) {
        return "<div>" + itemData.selectionText + "</div>";
    }

    function build(activeNotes) {
        notes = activeNotes;
        setUpContextMenus();
    }

    const obj = {
        buildWith: build
    };

    if (!ContextMenuBuilderInstance) {
        ContextMenuBuilderInstance = obj
    }
    return ContextMenuBuilderInstance;
}();

/**
 * Genesis
 */
chrome.runtime.onInstalled.addListener(function(details) {
    if (!details.previousVersion) {
        localStorage.setItem("isNewInstallation", "true"); // registered here and google event triggered in view as there is no access to Utils here
    } else {
        localStorage.setItem("isNewInstallation", "false");
    }
    launchNotes();
});

function launchNotes() {

    return new Promise(resolve => {
        loadLocalData();
        chrome.bookmarks.search(BOOKMARK_NAME, function(bookmarkTreeNodes) {
            // bookmarkTreeNodes sample "[{"dateAdded":1580827736483,"dateGroupModified":1589585176156,"id":"512","index":1,"parentId":"2","title":"CuteNotepad"}]"
            if (bookmarkTreeNodes.length === 0) {
                // fresh
                bootstrapNotes(launchTrash);
            } else {
                Model.bookmarkData = bookmarkTreeNodes[0];
                launchTrash();
                chrome.bookmarks.getSubTree(Model.bookmarkData.id, function(bookmarkTreeNodes) {
                    var activeNotes = [];
                    bookmarkTreeNodes[0].children.forEach((item) => {
                        //No children means they are active notes.
                        if (!item.children) {
                            item.deleted = item.deleted ? item.deleted : false;
                            activeNotes.push(item);
                        }
                    });
                    var orderMap = localStorage['orderMap'] &&
                        (typeof localStorage['orderMap'] === "string") &&
                        JSON.parse(localStorage['orderMap']) || {};

                    activeNotes.sort((a, b) => {
                        //Means no children - if children then it means it is a trash notes folder
                        if (!(a.children || b.children)) {
                            if (orderMap[a.id] && orderMap[b.id]) {
                                return orderMap[a.id].displayOrder - orderMap[b.id].displayOrder;
                            } else {
                                return 1;
                            }
                        }
                    });
                    ContextMenuBuilder.buildWith(activeNotes);
                    resolve();
                });
            }
        });
    }, reject => {
        // unlikely todo
    });
}

function bootstrapNotes(cb) {
    chrome.bookmarks.create({ "title": BOOKMARK_NAME }, function(bookmarkTreeNode) {
        Model.bookmarkData = bookmarkTreeNode;
        ContextMenuBuilder.buildWith([]);
        cb && cb();
    });
}

function launchTrash() {
    chrome.bookmarks.search(TRASH_BOOKMARK_NAME, function(trashTreeNodes) {
        if (trashTreeNodes.length === 0) {
            bootstrapTrash();
        } else {
            Model.trashedFolderData = trashTreeNodes[0];
        }
    });
}

function bootstrapTrash() {
    chrome.bookmarks.create({ "title": TRASH_BOOKMARK_NAME, parentId: Model.bookmarkData.id }, function(trashTreeNode) {
        Model.trashedFolderData = trashTreeNode;
    });
}

function loadLocalData() {
    if (localStorage['data']) {
        try {
            Model.data = JSON.parse(localStorage['data']);
            Model.selectedNoteId = Model.data.selectedNoteId;
            Model.collapsed = Model.data.collapsed;
        } catch (ex) {
            Model.data = null;
        }
    }

    // Initialize this.data
    if (!Model.data) {
        Model.data = {
            'content': '',
            'selection': {
                'start': 0,
                'end': 9
            },
            'scroll': {
                'left': 0,
                'top': 0
            },
            'size': {
                'width': 100,
                'height': 80
            },
            'options': {
                'sync': true
            }
        }
    }
    if (!Model.data.options) {
        Model.data.options = {
            'sync': true
        }
    }
}

function loadConfig(cb) {
    chrome.storage.sync.get({
        fontSize: "14px",
        fontFamily: "default",
        size: 300
    }, function (item) {
        cb(item);
    });
}

function getCoronaMessage() {
    var messages = [{message: "Coronavirus: Do not leave your home", emoji: "🏡"},
        {message: "Coronavirus: Regularly and thoroughly clean your hands", emoji: "👐"},
        {message: "Coronavirus: Stay at least 3 feet away from others", emoji: "⇠⇢"},
        {message: "Coronavirus: Work from home if you can ", emoji: "💻"},
        {message: "Coronavirus: If unwell isolate yourself from family", emoji: "😷"},
        {message: "Coronavirus: Cover coughs and sneezes", emoji: "💦"}
    ];

    return messages[Math.floor(Math.random() * Math.floor(messages.length))];
}
