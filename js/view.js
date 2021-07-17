function getBgPg() {
    return chrome.extension.getBackgroundPage();
}
function getModel() {
    return getBgPg().Model;
}
var View = function() {
    var localbaseURL = "http://localhost:8080";
    this.serverBaseURL = `http://18.236.147.127:8080`;
    this.serverContext = "notepad";
    this.initialized = false;
    this.tinymceDef = jQuery.Deferred();

    this.mode = "NOTES_ACTIVE";
    this.activeNotes_searchStr = "";
    this.inactiveNotes_searchStr = "";
    this.activeNotes = [];
    this.inactiveNotes = [];
    this.actionsView = new Actions();
    this.orderMap = localStorage['orderMap'] &&
        (typeof localStorage['orderMap'] === "string") &&
        JSON.parse(localStorage['orderMap']) || {};
    this.content;


};
View.prototype.getNoteTitleFromContent = function(content, subStringIndex = 15) {
    var d = document.createElement('div');
    d.innerHTML = content;
    return d.textContent.trim().substring(0, subStringIndex) || "New Note";
};
View.prototype.initTinymce = function(settings) {
    var self = this;
    tinymce.init({
        init_instance_callback: $.proxy(self.onInitTinyMce, self),
        selector: '#notepad',
        font_formats: 'Webkit-pictograph=-webkit-pictograph;Webkit-body=-webkit-body;Fantasy=fantasy;Cursive=cursive;Monospace=monospace;arial=arial,helvetica,sans-serif;Courier New=courier new,courier,monospace;Sans Serif=sans-serif;Serif=serif',
        menubar: false,
        plugins: [ //charmap paste insertdatetime fullscreen searchreplace print image media contextmenu backcolor forecolor visualblocks link autoresize autolink
            'advlist lists table paste',
        ],
        paste_as_text: true,
        toolbar: 'insert | bold italic underline strikethrough | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | table',
        content_css: ['/css/editorStyles.css'],
        extended_valid_elements : 'div/p[*]',//added to remove custom css on p tag
        forced_root_block : "div",
        contextmenu: "",
        remove_trailing_brs: false,
        content_style: `body { font-size: ${settings.fontSize}; font-family: ${settings.fontFamily} !important; }`,
        width: '100%',
        height: 'auto',
        setup: (editor) => {
            editor.on('keyup', function(e) {
                self.save(editor.getContent());
            });
            //wen toolbar option selected. useful wen text is selected and then toolbar option is selected
            editor.on('ExecCommand', function(e) {
                self.save(editor.getContent());
            });
            editor.on('init', function (e) {
            
            });
        }
    });
};
View.prototype.onInitTinyMce = function(e) {
    var self = this;
    //event wen table/image is resized
    tinymce.activeEditor.on('ObjectResized', function(e) {
        self.save(self.getContent());
    });
    tinymce.activeEditor.on('ExecCommand', function(e) {
        Utils.trackGoogleEvent("EDITOR_COMMAND_USE", e.command === "mceToggleFormat" ? e.value : e.command);
    });
    this.tinymceDef.resolve();
};
View.prototype.giveCoronaFooterMessage = function () {
    $ele = this.$el.find(".staysafe");
    const messageObj = getBgPg().getCoronaMessage();
    $ele.html(messageObj.message + " " + messageObj.emoji);
};
View.prototype.initialize = function() {
    if (this.initialized === true) return;
    this.initialized = true;

    this.$el = $("body");
    if (!getModel().userInfo) {
        this.$el.find(".syncNotes").html("Login")
    }
    this.$textArea = this.$el.find("#notepad");
    this._shareView = Object.create(ShareView);
    this._shareView.init(21, 22);
    this.shareFormTemplate = '' +
        '<div id="dialog-form" title="Share Note">' +
        '<div class="content">' +
        '<div class="formContent">' +
        '<label for="name">URL</label>' +
        '<input type="text" name="url" id="url" value="" class="text">' +
        '<div class="cpy">Copy</div>' +
        '</div>' +
        '<div class="footer">' +
        '<p class="note">If you want to stop the user to see the url, click on the below link</p>' +
        '<div class="stop">Stop Sharing</div>' +
        '</div>' +
        '</div>' +
        '</div>';

    if (!getModel().bookmarkData.id) {
        getBgPg().launchNotes().then(() => {
            this.setUp();
        });
    } else {
        this.setUp();
    }
};
View.prototype.setUp = function () {

    getBgPg().loadConfig((item) => {
        var height = Number(item.size);
        height = (height > 600 && height < 300) || !height ? 300 : height;
        document.body.style.height = height + "px";
        this.initTinymce(item);
    });

    getModel().data && getModel().data.synced && this.$el.find(".sync").html(Utils.getDT(getModel().data.synced));
    this.giveCoronaFooterMessage();

    if (getModel().collapsed) {
        this.$el.find(".rpanel").css({ width: "100%" });
        this.$el.find(".collapse-action").removeClass("collapse-arrow").addClass("expand-arrow");
    }

    var self = this;
    this.renderFolders(function(cuteNotepadChildren) {
        var childrenSansTrash = cuteNotepadChildren.filter(function (child) {
            return child.children == null
        });
        self.$el.find(".folder-name").eq(0).addClass("active");
        self.content = childrenSansTrash[0] && childrenSansTrash[0].url && childrenSansTrash[0].url.replace("data:text/plain;charset=UTF-8,", "") || "";

        if (!childrenSansTrash.length) {
            //Means there is a Root bookmark but no notes. So lets create one note:
            self.content = "";
            self.newNoteInitiator(self.content);
        } else {
            if (self.$el.find(".folder-name[data-bid='" + getModel().selectedNoteId + "']").length) {
                self.$el.find(".folder-name[data-bid='" + getModel().selectedNoteId + "']").trigger("click");
            } else {
                getModel().selectedNoteId = childrenSansTrash && childrenSansTrash[0] && childrenSansTrash[0].id;
                self.$el.find(".folder-name[data-bid='" + getModel().selectedNoteId + "']").trigger("click");
            }
        }

        self.userStatus();
        // todo render trashed notes
    });

    this.bindEvents();
    this.$el.find(".settings").attr("href", "chrome-extension://" + chrome.runtime.id + "/options.html");
    setTimeout(() => {
        this.$el.find(".folderMenu, .rpanel").css({
            height : "100vh"
        });
    }, 100);
};
View.prototype.renderShareView = function renderShareView() {
    if (this.mode === "NOTES_ACTIVE") {
        this._shareView.render(this.$el.find(".right-actions"), getModel().selectedNoteId);
        this.$el.find(".shareBtn").click(this.invokeShareDialog.bind(this));
    }
};
View.prototype.invokeShareDialog = function invokeShareDialog() {
    if (!this.$el.find(".dialog-form")[0]) this.$el.append(this.shareFormTemplate);
    this._shareView.showDilaog(this.$el.find("#dialog-form"), this.$el.find(".container"));
};
View.prototype.save = function(content) {
    var self = this;
    clearTimeout(this.saveTimer);

    this.saveTimer = setTimeout(function() {
        if (content !== undefined && content !== getModel().data['content']) {
            getModel().data['content'] = Utils.encodePercentSymbol(content);
            getModel().data.updated = new Date().getTime();
            getModel().data.selectedNoteId = getModel().selectedNoteId;
            getModel().data.collapsed = getModel().collapsed;
            getModel().data.synced = +(new Date());
            getModel().data.deleted = false;
        }

        localStorage['data'] = JSON.stringify(getModel().data);
        const title = self.getNoteTitleFromContent(content);
        chrome.bookmarks.update(getModel().selectedNoteId, {
            title: title,
            url: "data:text/plain;charset=UTF-8," + Utils.encodePercentSymbol(content)
        }, function(updatedNote) {
            self.$el.find('.folder-items').find(`[data-bid='${getModel().selectedNoteId}']`).html(title);
            // get updated one and update context menu so that its at the top
            const index = self.activeNotes.findIndex(note => note.id === updatedNote.id);
            self.activeNotes.splice(index, 1);
            self.activeNotes.splice(0,0, updatedNote);
            getBgPg().ContextMenuBuilder.buildWith(self.activeNotes);
        });
    }, 250);
};
View.prototype.renderFolders = function(cb) {
    var self = this;
    var title = "";

    self.activeNotes = [];
    self.inactiveNotes = [];
    chrome.bookmarks.getSubTree(getModel().bookmarkData.id, function(bookmarkTreeNodes) {

        self.$el.find('.folder-items').empty();

        var sortedChildren = bookmarkTreeNodes[0].children.sort(function(a, b) {
            //Means no children - if children then it means it is a trash notes folder
            if (!(a.children || b.children)) {
                if (self.orderMap[a.id] && self.orderMap[b.id]) {
                    return self.orderMap[a.id].displayOrder - self.orderMap[b.id].displayOrder;
                } else {
                    return 1;
                }
            }
        });

        sortedChildren.forEach((item) => {
            //No children means they are active notes. 
            if (!item.children) {
                item.deleted = item.deleted ? item.deleted : false;
                self.activeNotes.push(item);
                title = item.title && self.getNoteTitleFromContent(item.title);
                self.$el.find('.folder-items').append("<div class = 'folder-name' data-bid = '" + item.id + "'>" + title + "</div>");
            } else {
                self.inactiveNotes = item.children;
            }
        });
        getBgPg().ContextMenuBuilder.buildWith(self.activeNotes);
        var $text = $("<span>").attr({ class: "activeModeText" }).html("Recycle bin Notes");
        var $nos = $("<span>").attr({ class: "activeNos" }).html(self.inactiveNotes.length);
        self.$el.find(".trashed").html("").append($text).append($nos);
        self.hightlightSelected();
        cb && cb(bookmarkTreeNodes[0].children);
    });
};
View.prototype.newNoteInitiator = function(content) {
    var self = this;
    // get editor ready
    self.setContent(decodeURIComponent(Utils.encodeURIComponent(content)), () => {
        // create a new bookmark entry
        this.createNote(decodeURIComponent(Utils.encodeURIComponent(content)));
    });
};
View.prototype.createNote = function(content) {
    chrome.bookmarks.create({
        parentId: getModel().bookmarkData.id,
        title: content ? self.getNoteTitleFromContent(content) : "New Note",
        url: "data:text/plain;charset=UTF-8," + content
    }, note => {
        getModel().selectedNoteId = note.id;
        this.activeNotes.unshift(note);
        getBgPg().ContextMenuBuilder.buildWith(this.activeNotes);
        const title = note.title && this.getNoteTitleFromContent(note.title);
        this.$el.find('.folder-items').prepend(`<div class='folder-name' data-bid='${note.id}'>${title}</div>`);
        this.hightlightSelected();
        this.upsertSelectedNote();
        if (this.$el.find(".folder-name").length === 1) {
            this.save(this.getContent());
        }
        this.updateDisplayOrder()
    });
};
View.prototype.hightlightSelected = function() {
    this.$el.find(".folder-name").removeClass("active");
    this.$el.find(".folder-name[data-bid='" + getModel().selectedNoteId + "']").addClass("active");
};
View.prototype.hightlightSelectedDeleted = function() {
    this.$el.find(".deleted-note-name").removeClass("active");
    this.$el.find(".deleted-note-name[data-bid='" + getModel().deletedSelectedNoteId + "']").addClass("active");
};
View.prototype.searchFolders = function(value) {
    var self = this;
    var subset;
    if (this.mode === "NOTES_ACTIVE") {
        this.activeNotes_searchStr = value;
        if (value.trim() === "") {
            subset = this.activeNotes;
        } else {
            subset = this.activeNotes.filter(function(item) {
                return item.url.toLowerCase().indexOf(value.toLowerCase()) > 0 || item.title.toLowerCase().indexOf(value.toLowerCase()) > 0;
            });
        }

        this.$el.find('.folder-items').empty();

        subset.forEach((item) => {
            var title = item.title && self.getNoteTitleFromContent(item.title);
            self.$el.find('.folder-items').append("<div class = 'folder-name' data-bid = '" + item.id + "'>" + title + "</div>");
        });
        self.hightlightSelected();

    } else {
        self.inactiveNotes_searchStr = value;
        if (value.trim() === "") {
            subset = this.inactiveNotes;
        } else {
            subset = this.inactiveNotes.filter(function(item) {
                return item.url.toLowerCase().indexOf(value.toLowerCase()) > 0 || item.title.toLowerCase().indexOf(value.toLowerCase()) > 0;
            });
        }

        this.$el.find('.trash').empty();

        subset.forEach(function(item) {
            var title = item.title && self.getNoteTitleFromContent(item.title, 10);
            self.$el.find('.trash').append("<div class = 'deleted-note-name' data-bid = '" + item.id + "'><span>" + title + "</span><span class='actions'><span class='restore' title='Restore'></span><span class='delete' title='Delete Forever'></span></span></div>");
        });
        self.hightlightSelectedDeleted();
    }

};
View.prototype.updateDisplayOrder = function() {
    this.orderMap = {};
    var self = this;
    this.$el.find(".folder-name").each(function(iter, item) {
        self.orderMap[item.getAttribute("data-bid")] = {
            displayOrder: iter
        }
    });
    this.activeNotes.sort((a, b) => {
        if (this.orderMap[a.id] && this.orderMap[b.id]) {
            return this.orderMap[a.id].displayOrder - this.orderMap[b.id].displayOrder;
        } else {
            return 1;
        }
    });
    getBgPg().ContextMenuBuilder.buildWith(this.activeNotes);
    Utils.trackGoogleEvent("NOTE_REORDERED");
    localStorage['orderMap'] = JSON.stringify(this.orderMap);
};
View.prototype.loadNotebyId = function(bookmarkId, isDeleteNotes) {
    var self = this;
    chrome.bookmarks.getSubTree(isDeleteNotes ? getModel().trashedFolderData.id : getModel().bookmarkData.id, function(bookmarkTreeNodes) {
        var bookmark = bookmarkTreeNodes[0].children.filter(function(item) {
            return item.id === bookmarkId;
        });

        var content = bookmark[0] && bookmark[0].url || "";
        content = content.replace("data:text/plain;charset=UTF-8,", "");
        content = decodeURIComponent(content);
        self.setContent(content);
    });
};
View.prototype.getContent = function() {
    // Get the raw contents of the currently active editor
    return tinymce.activeEditor.getContent();
};
View.prototype.setContent = function(content, cb) {
    this.tinymceDef.then(() => {
        tinymce.activeEditor.setContent(content);
        tinymce.activeEditor.undoManager.clear();
        this.setfocusInEditor();
        cb && cb();
    });
};
View.prototype.setfocusInEditor = function() {
    if (tinymce) {
        tinymce.activeEditor.focus();
        tinymce.activeEditor.selection.select(tinymce.activeEditor.getBody(), true);
        tinymce.activeEditor.selection.collapse(false);
        if(!this.isDeleteMode) {
            Utils.scrollToEnd(tinyMCE.activeEditor.iframeElement);
        }
    }
};
View.prototype.upsertSelectedNote = function() {
    try {
        getModel().data.selectedNoteId = getModel().selectedNoteId;
    } catch (e) {
        console.info("Error " + e.message);
    }
    localStorage['data'] = JSON.stringify(getModel().data);
};
View.prototype.upsertCollapse = function() {
    try {
        getModel().data.collapsed = getModel().collapsed;
    } catch (e) {
        console.info("Error " + e.message);
    }
    localStorage['data'] = JSON.stringify(getModel().data);
};
View.prototype.renderDeletedNotes = function(cb) {
    var self = this;
    chrome.bookmarks.getSubTree(getModel().trashedFolderData.id, function(data) {
        self.$el.find('.trash').empty();
        var trashList = data[0].children;
        trashList.forEach(function(item) {
            title = item.title && self.getNoteTitleFromContent(item.title, 10);
            self.$el.find('.trash').append("<div class = 'deleted-note-name' data-bid = '" + item.id + "'><span>" + title + "</span><span class='actions'><span class='restore' title='Restore'></span><span class='delete' title='Delete Forever'></span></span></div>");
        });
        cb && cb();
    });
};
View.prototype.deleteActiveNote = function (selectedNoteId) {
    const index = this.activeNotes.findIndex(note => note.id === selectedNoteId);
    this.inactiveNotes.push(this.activeNotes[index]);
    this.activeNotes.splice(index, 1);
    getBgPg().ContextMenuBuilder.buildWith(this.activeNotes)
};
View.prototype.addToActiveNotes = function (noteToRestore) {
    const index = this.inactiveNotes.findIndex(note => note.id === noteToRestore.id);
    this.activeNotes.push(noteToRestore);
    this.inactiveNotes.splice(index, 1);
    getBgPg().ContextMenuBuilder.buildWith(this.activeNotes)
};
View.prototype.setReadMode = function(flag) {
    this.isDeleteMode = flag;
    var editorCtn = tinymce.activeEditor.getContainer();
    if (flag) {
        $(editorCtn).find(".mce-top-part,.tox-toolbar").hide();
        tinymce.activeEditor.getBody().setAttribute('contenteditable', false);
    } else {
        $(editorCtn).find(".mce-top-part,.tox-toolbar").show();
        tinymce.activeEditor.getBody().setAttribute('contenteditable', true);
    }
};
View.prototype.bindEvents = function() {
    var self = this;
    this.$el.find(".syncNotes").on("click", function() {
        if (getModel().userInfo && getModel().userInfo.inviteAccepted) {
            self.backupNotes();
        } else if (getModel().userInfo) {
            self.loginButtonStatus();
        } else {
            self.getUserData();
        }
    });

    this.$el.find(".newNoteBtn").on("click", function() {
        self.content = "";
        self.setContent(self.content);
        self.createNote("");
        Utils.trackGoogleEvent("NOTE_CREATION");
    });

    this.$el.find(".collapse-action").on("click", function() {
        var $this = $(this);
        if ($this.hasClass("expand-arrow")) {
            $this.removeClass("expand-arrow").addClass("collapse-arrow");
            self.$el.find(".rpanel").animate({ width: "620px" });
            getModel().collapsed = false;
        } else {
            Utils.trackGoogleEvent("NOTE_FULL_MODE");
            $this.removeClass("collapse-arrow").addClass("expand-arrow");
            $(".rpanel").animate({ width: "100%" });
            getModel().collapsed = true;
        }
        self.upsertCollapse();
    });

    
    

    this.$el.find(".folderMenu").delegate(".folder-name", "click", function() {
        var $this = $(this);
        $(".folder-name").removeClass("active");
        $this.addClass("active");
        getModel().selectedNoteId = $this.attr("data-bid");
        self._shareView.setSelectedNote(getModel().selectedNoteId);
        self.loadNotebyId($this.attr("data-bid"), false);
        self.upsertSelectedNote();
    });

    this.$el.find(".delete-action").on("click", function() {
        // remove from left side tile list
        self.$el.find(".folder-items .folder-name[data-bid=" + getModel().selectedNoteId + "]").remove();

        // Get the next in order note's bookmark id, so that we make that active
        var nextNoteId = self.$el.find(".folder-items .folder-name[data-bid=" + getModel().selectedNoteId + "]").next().attr("data-bid");
        self.setContent("");

        chrome.bookmarks.move(getModel().selectedNoteId, { parentId: getModel().trashedFolderData.id }, function () {

            Utils.trackGoogleEvent("NOTE_SOFT_DELETION");

            // update active notes
            self.deleteActiveNote(getModel().selectedNoteId);
            // update count of recycle bin
            self.$el.find(".activeNos").html(self.inactiveNotes.length);
            var $next;

            if (!nextNoteId && self.$el.find(".folder-items .folder-name").length) {
                /*  The case when nextNode wasn't available because it was the last in list
                    make the first one active in that case
                */
                $next = self.$el.find(".folder-items .folder-name").eq(0);
                nextNoteId = $next.attr("data-bid");
            } else if (!nextNoteId && !self.$el.find(".folder-items .folder-name").length) {
                /*  The case when no more active notes are present
                */
                self.newNoteInitiator("");
            } else {
                $next = self.$el.find(".folder-items .folder-name[data-bid=" + nextNoteId + "]");
            }
            if ($next) {
                $next.addClass("active");
                getModel().selectedNoteId = nextNoteId;
                self.loadNotebyId(getModel().selectedNoteId);
                self.upsertSelectedNote();
            }
        });
    });

    this.$el.find(".trashed").click(function() {
        self.$el.find(".folder-search").val("");
        self.$el.find(".trashed").toggleClass("active");
        if (!self.$el.find(".trash").hasClass("expanded")) {
            Utils.trackGoogleEvent("NOTE_BIN_VISITED");
            self.mode = "NOTES_INACTIVE";
            var $backArrow = $("<span>").attr({ "class": "backArrow" })
                .css({
                    "background-image": "url('" + "./icons/back-arrow.svg" + "')",
                    "background-repeat": "no-repeat",
                    "width": "15px",
                    "height": "13px",
                    "margin-top": "-2px"
                });
            var $backText = $("<span>").attr({ "class": "backText" })
                .css({
                    "margin-left": "10px"
                }).html("Back to Notes");
            self.$el.find(".trashed").html("").append($backArrow).append($backText);
            self.$el.find(".delete-action, .newNoteBtn, .collapse-action, .folder-items, .actionsBtn").hide();
            self._shareView.hide();
            self.$el.find(".trash").addClass("expanded").show();

            self.renderDeletedNotes();
            self.setContent("");
            self.setReadMode(true);
        } else {
            self.$el.find(".trash").removeClass("expanded").hide();
            self.mode = "NOTES_ACTIVE";
            self.setContent("");
            //self.$el.find(".trash").html("");
            self.$el.find(".delete-action, .newNoteBtn, .collapse-action, .folder-items, .actionsBtn").show();
            self._shareView.show();
            self.renderFolders();
            self.loadNotebyId(getModel().selectedNoteId, false);
            self.setReadMode(false);
        }
    });

    this.$el.find(".folder-search").keyup(function(evt) {
        var $this = $(this);
        var value = $this.val().trim();

        self.searchFolders(value);
    });

    this.$el.find(".trash").delegate(".deleted-note-name", "click", function(event) {
        self.$el.find(".deleted-note-name").removeClass("active");
        $(event.currentTarget).addClass("active");
        var noteId = $(this).attr("data-bid");
        getModel().deletedSelectedNoteId = noteId;
        if (noteId) {
            self.loadNotebyId(noteId, true);
        }
    });

    this.$el.find(".trash").delegate(".deleted-note-name .restore", "click", function() {
        var $toRestore = $(this).parents(".deleted-note-name");
        var noteId = $toRestore.attr("data-bid");
        self.setContent("");
        $toRestore.remove();

        chrome.bookmarks.move(noteId, { parentId: getModel().bookmarkData.id }, function(data) {
            Utils.trackGoogleEvent("NOTE_RESTORATION");

            // update active notes
            self.addToActiveNotes(data);

            title = data.title && self.getNoteTitleFromContent(data.title.substr, 10);
            $('.folder-items').append("<div class = 'folder-name' data-bid = '" + data.id + "'>" + title + "</div>");
        });
    });

    this.$el.find(".trash").delegate(".deleted-note-name .delete", "click", function() {

        self.inactiveNotes = self.inactiveNotes || [];
        var $noteToDelete = $(this).parents(".deleted-note-name");
        var noteId = $noteToDelete.attr("data-bid");
        self.inactiveNotes = self.inactiveNotes.filter(function(item) {
            return item.id !== noteId;
        });
        chrome.bookmarks.remove(noteId, function() {
            Utils.trackGoogleEvent("NOTE_HARD_DELETION");
            self.setContent("");
            $noteToDelete.remove();
        })
    });

    //Sortable Notes down below here
    this.$el.find(".folder-items").sortable({
        tolerance: "pointer",
        containment: "parent",
        update: function(event, ui) {
            var ele = $(ui);
            self.updateDisplayOrder();
        }
    });

    //Actions dropdown

    this.$el.find(".actionsBtn").click(function() {
        self.actionsView && self.actionsView.show();
    });
};

View.prototype.getUserData = function() {
    var self = this;
    var apiKey = "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
    chrome.identity.getAuthToken({
        interactive: true
    }, (token) => {
        let init = {
            method: 'GET',
            async: true,
            headers: {
                Authorization: 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            'contentType': 'json'
        };
        fetch('https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses,phoneNumbers&key='+ apiKey, init)
            .then((response) => response.json())
            .then((data) => {
                self.registerUser(data)
            });
    });
};
View.prototype.backupNotes = function () {
    var self = this;
    var postBody = this.activeNotes.map(function (note, index) {
       return {
           bookmarkId: note.id,
           richText: note.url,
           displayOrder: index,
           dateAdded: note.dateAdded,
           deleted: false
       }
    });
    fetch(`${this.serverBaseURL}/${this.serverContext}/note/backup`,{
        method: "POST",
        headers: {
            "Content-Type":"application/json",
            "Authorization":"Bearer " + getModel().jwtToken
        },
        body: JSON.stringify(postBody)
    })
        .then((response) => response.json())
        .then((data) => {
            getModel().backup = {
                date: new Date()
            };
            self.loginButtonStatus();
        }).catch(() => {
        alert("Try again later");
    });
};
View.prototype.loginButtonStatus = function () {
    var message = "";
    if(getModel().userInfo) {
        if (getModel().userInfo.inviteAccepted) {
            // show backup option
            if (getModel().backup && getModel().backup.date) {
                const options1 = { year: 'numeric', month: 'long', day: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' };
                const dateTimeFormat = new Intl.DateTimeFormat('en-GB', options1);
                message = "(Last backup on: " + dateTimeFormat.format(getModel().backup.date) + ") ";
            }
            message += "Backup";
        } else {
            // show under process option
            message = "Your invitation is being processed";
        }
    } else {
        // show login
        message = "Login";
    }
    this.$el.find(".syncNotes").html(message);
};

View.prototype.registerUser = function (data) {
    var self = this;
    // process data
    var postBody = {
        googleId:data.names[0].metadata.source.id,
        firstName:data.names[0].givenName,
        lastName:data.names[0].familyName,
        emailAddress:data.emailAddresses.map(address => address.value),
        phoneNumber:data.phoneNumbers && data.phoneNumbers.map(number => number.value)
    };
    fetch(`${this.serverBaseURL}/${this.serverContext}/user/register`,{
        method: "POST",
        headers: {
            "Content-Type":"application/json"
        },
        body: JSON.stringify(postBody)
    })
        .then((response) => response.json())
        .then((data) => {
            getModel().userInfo = data.data;
            getModel().jwtToken = data.additionalInfo.token;
            sessionStorage.setItem("nci", data.data.id);
            self.loginButtonStatus();
        }).catch(() => {
            alert("Try again later");
    });
};
View.prototype.userStatus = function () {
    var self = this;
    if (getModel().userInfo && !getModel().userInfo.inviteAccepted) {
        fetch(`${self.serverBaseURL}/${self.serverContext}/user/details`, {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + getModel().jwtToken
            }
        })
            .then((response) => response.json())
            .then((data) => {
                getModel().userInfo.inviteAccepted = data.data.inviteAccepted;
                self.loginButtonStatus();
            });
    } else {
        self.loginButtonStatus();
    }
};
document.addEventListener('DOMContentLoaded', function() {
    if (location.href.indexOf('popup.html') !== -1) {
        // check params
        var params = new URLSearchParams(window.location.search);
        var mode = params.get("print");

        // initialize print if print mode else launch app
        if (mode === "true") {
            var selectedId = getModel().selectedNoteId;
            if (selectedId) {
                try {
                    chrome.bookmarks.get(selectedId, function(arrayOfBookmarks) {
                        if (arrayOfBookmarks.length === 1) {
                            var content = Utils.getDisplayableContent(arrayOfBookmarks[0].url);
                            Utils.printNote(content);
                        }
                    });
                } catch (e) {
                    console.info("Couldn't find note to print");
                    console.error(e);
                }
            }
            $("#printArea").show();
        } else {
            googleEventForNewInstallation();
            var view = new View();
            view.initialize();
            setTimeout(function() {
                view.$el.find(".folder-search").removeAttr("disabled");
            }, 500);
        }
    }
}, false);

function googleEventForNewInstallation() {
    // check if extension new installation or extension update
    if (localStorage.getItem("isNewInstallation") === null) {
        // nothing to do
    } else {
        if (localStorage.getItem("isNewInstallation") === "true") {
            Utils.trackGoogleEvent("INSTALLED");
        } else if (localStorage.getItem("isNewInstallation") === "false" ) {
            Utils.trackGoogleEvent("EXTENSION_UPDATE");
        }
        localStorage.removeItem("isNewInstallation");
    }
}
