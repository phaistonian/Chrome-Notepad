var parentBookmarkId = "0";

var View = function() {
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
    this.model = new Model();
}
View.prototype.getNoteTitleFromContent = function(content, subStringIndex = 15) {
    var d = document.createElement('div');
    d.innerHTML = content;
    return d.textContent.trim().substring(0, subStringIndex) || "New Note";
}

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
}
View.prototype.onInitTinyMce = function(e) {
    var self = this;
    //event wen table/image is resized
    tinymce.activeEditor.on('ObjectResized', function(e) {
        self.save(self.getContent());
    });
    this.tinymceDef.resolve();
}
View.prototype.initialize = function() {
    if (this.initialized === true) return;
    this.initialized = true;

    //Load data from local storage
    this.model.initialize();

    this.$el = $("body");
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


    var self = this;
    this.model.loadConfig((item) => {
        var height = Number(item.size);
        height = (height > 600 && height < 300) || !height ? 300 : height;
        document.body.style.height = height + "px";
        this.initTinymce(item);
    });

    this.model.reportSync(this.$el);

    if (this.model.collapsed) {
        this.$el.find(".rpanel").css({ width: "100%" });
        this.$el.find(".collapse-action").removeClass("collapse-arrow").addClass("expand-arrow");
    }

    var self = this;
    this.checkIfBookmarkExists("CuteNotepad", function(data) {
        //This means bookmark is found for this extension
        if (data) {

            self.model.bookmarkData = data;
            self.renderFolders(function(cuteNotepadChildren) {

                self.$el.find(".folder-name").eq(0).addClass("active");
                self.content = cuteNotepadChildren[0] && cuteNotepadChildren[0].url && cuteNotepadChildren[0].url.replace("data:text/plain;charset=UTF-8,", "") || "";
                //self.setContent(Utils.removeLineBreaks(self.content) || "");

                if (!cuteNotepadChildren.length) {
                    //Means there is a Root bookmark but no notes. So lets create one note:
                    self.content = self.model.data && self.model.data.content || "";
                    self.newNoteInitiator(self.content);

                } else {

                    if (self.$el.find(".folder-name[data-bid='" + self.model.selectedNoteId + "']").length) {
                        self.$el.find(".folder-name[data-bid='" + self.model.selectedNoteId + "']").trigger("click");
                    } else {
                        var _tempChild = cuteNotepadChildren.filter(function(item) {
                            return !item.children;
                        });
                        self.model.selectedNoteId = _tempChild && _tempChild[0] && _tempChild[0].id;
                        self.$el.find(".folder-name[data-bid='" + self.model.selectedNoteId + "']").trigger("click");
                    }
                    //self.renderShareView();
                }

                self.checkIfBookmarkExists("trashedNotes", function(data) {
                    if (!data) {
                        //new subfolder: to hold deleted bookmarks
                        chrome.bookmarks.create({ "title": "trashedNotes", parentId: self.model.bookmarkData.id }, function(data) {
                            self.model.trashedFolderData = data;
                        });
                    } else {
                        self.model.trashedFolderData = data;
                    }
                });
            });
        } else {
            //No bookmark found, hence create one
            Utils.trackGoogleEvent("INSTALLED");
            chrome.bookmarks.create({ "title": "CuteNotepad" }, function(newFolder) {

                content = self.model.data && self.model.data.content || "";
                self.model.bookmarkData = newFolder;

                self.createNote(content, function(note) {
                    self.renderFolders(function(bookmarksTree) {
                        if (bookmarksTree && bookmarksTree[0]) {
                            self.model.selectedNoteId = note.id;
                            //self.renderShareView();
                        }
                        self.$el.find(".folder-name").eq(0).addClass("active");
                        self.setfocusInEditor();

                        self.checkIfBookmarkExists("trashedNotes", function(data) {
                            if (!data) {
                                //new subfolder: to hold deleted bookmarks
                                chrome.bookmarks.create({ "title": "trashedNotes", parentId: self.model.bookmarkData.id }, function(data) {
                                    self.model.trashedFolderData = data;
                                    self.renderDeletedNotes(function() {});
                                });
                            } else {
                                self.model.trashedFolderData = data;
                            }
                        });
                    });
                });

            });
        }
    });
    self.bindEvents();
    self.$el.find(".settings").attr("href", "chrome-extension://" + chrome.runtime.id + "/options.html");
};
View.prototype.renderShareView = function renderShareView() {
    if (this.mode == "NOTES_ACTIVE") {
        this._shareView.render(this.$el.find(".right-actions"), this.model.selectedNoteId);
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

        if (content !== undefined && content !== self.model.data['content']) {
            self.model.data['content'] = Utils.encodePercentSymbol(content);
            self.model.data.updated = new Date().getTime();
            self.model.data.selectedNoteId = self.model.selectedNoteId;
            self.model.data.collapsed = self.model.collapsed;
            self.model.data.synced = +(new Date());
            self.model.data.deleted = false;
        }

        localStorage['data'] = JSON.stringify(self.model.data);

        chrome.bookmarks.update(self.model.selectedNoteId, {
            title: self.getNoteTitleFromContent(content),
            url: "data:text/plain;charset=UTF-8," + Utils.encodePercentSymbol(content) //Utils.addLineBreaks(content)
        }, function() {
            self.renderFolders(function(bookmarksTree) {
                self.searchFolders(self.$el.find(".folder-search").val());
                self.hightlightSelected();
            });
        });
    }, 250);
};
View.prototype.renderFolders = function(cb) {
    var self = this;
    var title = "";

    self.activeNotes = [];
    self.inactiveNotes = [];
    chrome.bookmarks.getSubTree(this.model.bookmarkData.id, function(bookmarkTreeNodes) {

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
        var $text = $("<span>").attr({ class: "activeModeText" }).html("Recycle bin Notes");
        var $nos = $("<span>").attr({ class: "activeNos" }).html(self.inactiveNotes.length);
        self.$el.find(".trashed").html("").append($text).append($nos);
        self.hightlightSelected();
        cb && cb(bookmarkTreeNodes[0].children);
    });
};
View.prototype.newNoteInitiator = function(content) {
    var self = this;
    self.setContent(decodeURIComponent(Utils.encodeURIComponent(content)));

    this.createNote(content, function(note) {
        self.model.selectedNoteId = note.id;
        self.renderFolders(function() {
            self.$el.find(".folder-name").removeClass("active");
            self.$el.find(".folder-name[data-bid='" + self.model.selectedNoteId + "']").addClass("active");
            self.setfocusInEditor();
            if (self.$el.find(".folder-name").length == 1) {
                self.save(self.getContent());
            }
            //self.renderShareView();
        });
    });
};
View.prototype.createNote = function(content, cb) {
    var self = this;
    chrome.bookmarks.create({
        parentId: this.model.bookmarkData.id,
        title: self.getNoteTitleFromContent(content),
        url: "data:text/plain;charset=UTF-8," + content //Utils.addLineBreaks(content)
    }, function(note) {
        self.model.selectedNoteId = note.id;
        cb && cb(note);
    });
};
View.prototype.hightlightSelected = function() {
    this.$el.find(".folder-name").removeClass("active");
    this.$el.find(".folder-name[data-bid='" + this.model.selectedNoteId + "']").addClass("active");
};
View.prototype.hightlightSelectedDeleted = function() {
    this.$el.find(".deleted-note-name").removeClass("active");
    this.$el.find(".deleted-note-name[data-bid='" + this.model.deletedSelectedNoteId + "']").addClass("active");
};
View.prototype.searchFolders = function(value) {
    var self = this;
    var subset;
    if (this.mode == "NOTES_ACTIVE") {
        this.activeNotes_searchStr = value;
        if (value.trim() == "") {
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
        if (value.trim() == "") {
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
View.prototype.checkIfBookmarkExists = function(name, cb) {
    var bookmarkTreeNodes = chrome.bookmarks.search(name, function(bookmarkTreeNodes) {
        cb(bookmarkTreeNodes[0]);
    });
};
View.prototype.updateDisplayOrder = function() {
    this.orderMap = {};
    var self = this;
    this.$el.find(".folder-name").each(function(iter, item) {
        self.orderMap[item.getAttribute("data-bid")] = {
            displayOrder: iter
        }
    });
    Utils.trackGoogleEvent("NOTE_REORDERED");
    localStorage['orderMap'] = JSON.stringify(this.orderMap);
};
View.prototype.loadNotebyId = function(bookmarkId, preview) {
    var self = this;
    if (preview) {
        chrome.bookmarks.getSubTree(this.model.trashedFolderData.id, function(bookmarkTreeNodes) {
            var bookmark = bookmarkTreeNodes[0].children.filter(function(item) {
                return item.id === bookmarkId;
            });

            var content = bookmark[0] && bookmark[0].url || "";
            content = content.replace("data:text/plain;charset=UTF-8,", "");
            //content = Utils.removeLineBreaks(content);
            content = decodeURIComponent(content);
            self.setContent(content);
        });
    } else {
        chrome.bookmarks.getSubTree(this.model.bookmarkData.id, function(bookmarkTreeNodes) {
            var bookmark = bookmarkTreeNodes[0].children.filter(function(item) {
                return item.id === bookmarkId;
            });

            var content = bookmark[0] && bookmark[0].url || "";
            content = content.replace("data:text/plain;charset=UTF-8,", "");
            content = decodeURIComponent(content);
            //content = Utils.removeLineBreaks(content);
            self.setContent(content);
        });
    }
};
View.prototype.getContent = function() {
    // Get the raw contents of the currently active editor
    return tinymce.activeEditor.getContent();
}
View.prototype.setContent = function(content) {
    this.tinymceDef.then(() => {
        tinymce.activeEditor.setContent(content);
        tinymce.activeEditor.undoManager.clear();
        this.setfocusInEditor();
    });
}
View.prototype.setfocusInEditor = function() {

    if (tinymce) {
        tinymce.activeEditor.focus();
        tinymce.activeEditor.selection.select(tinymce.activeEditor.getBody(), true);
        tinymce.activeEditor.selection.collapse(false);
        if(!this.isDeleteMode) {
            Utils.scrollToEnd(tinyMCE.activeEditor.iframeElement);
        }
    }
}
View.prototype.upsertSelectedNote = function() {
    try {
        this.model.data.selectedNoteId = this.model.selectedNoteId;
    } catch (e) {
        console.info("Error " + e.message);
    }
    localStorage['data'] = JSON.stringify(this.model.data);
};
View.prototype.upsertCollapse = function() {
    try {
        this.model.data.collapsed = this.model.collapsed;
    } catch (e) {
        console.info("Error " + e.message);
    }
    localStorage['data'] = JSON.stringify(this.model.data);
};
View.prototype.renderDeletedNotes = function(cb) {
    var self = this;
    chrome.bookmarks.getSubTree(this.model.trashedFolderData.id, function(data) {
        self.$el.find('.trash').empty();
        var trashList = data[0].children;
        trashList.forEach(function(item) {
            title = item.title && self.getNoteTitleFromContent(item.title, 10);
            self.$el.find('.trash').append("<div class = 'deleted-note-name' data-bid = '" + item.id + "'><span>" + title + "</span><span class='actions'><span class='restore' title='Restore'></span><span class='delete' title='Delete Forever'></span></span></div>");
        });
        cb && cb();
    });
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
}
View.prototype.bindEvents = function() {
    var self = this;
    this.$el.find(".newNoteBtn").on("click", function() {
        self.content = "";
        self.setContent("")

        chrome.bookmarks.create({
            parentId: self.model.bookmarkData.id,
            title: "New Note",
            url: "data:text/plain;charset=UTF-8,"
        }, function(data) {
            self.model.selectedNoteId = data.id;
            self.renderFolders(function() {
                self.hightlightSelected();
                self.upsertSelectedNote();
            });
        });

        Utils.trackGoogleEvent("NOTE_CREATION");
    });

    this.$el.find(".collapse-action").on("click", function() {
        var $this = $(this);
        if ($this.hasClass("expand-arrow")) {
            $this.removeClass("expand-arrow").addClass("collapse-arrow");
            self.$el.find(".rpanel").animate({ width: "620px" });
            self.model.collapsed = false;
        } else {
            Utils.trackGoogleEvent("NOTE_FULL_MODE");
            $this.removeClass("collapse-arrow").addClass("expand-arrow");
            $(".rpanel").animate({ width: "100%" });
            self.model.collapsed = true;
        }
        self.upsertCollapse();
    });

    this.$el.find(".folderMenu").delegate(".folder-name", "click", function() {
        var $this = $(this);
        $(".folder-name").removeClass("active");
        $this.addClass("active");
        self.model.selectedNoteId = $this.attr("data-bid");
        self._shareView.setSelectedNote(self.model.selectedNoteId);
        self.loadNotebyId($this.attr("data-bid"), false);
        self.upsertSelectedNote();
    });

    this.$el.find(".delete-action").on("click", function() {

        // Get the next in order note's bookmark id, so that we make that active 
        var nextNoteId = self.$el.find(".folder-items .folder-name[data-bid=" + self.model.selectedNoteId + "]").next().attr("data-bid");
        self.setContent("");

        chrome.bookmarks.move(self.model.selectedNoteId, { parentId: self.model.trashedFolderData.id }, function(data) {

            Utils.trackGoogleEvent("NOTE_SOFT_DELETION");

            self.renderFolders(function(bookmarksTree) {

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
                    self.model.selectedNoteId = nextNoteId;
                    self.loadNotebyId(self.model.selectedNoteId);
                    self.upsertSelectedNote();
                }

            });
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
            self.loadNotebyId(self.model.selectedNoteId, false);
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
        self.model.deletedSelectedNoteId = noteId;
        if (noteId) {
            self.loadNotebyId(noteId, true);
        }
    });

    this.$el.find(".trash").delegate(".deleted-note-name .restore", "click", function() {
        var $toRestore = $(this).parents(".deleted-note-name");
        var noteId = $toRestore.attr("data-bid");
        self.setContent("");
        $toRestore.remove();

        chrome.bookmarks.move(noteId, { parentId: self.model.bookmarkData.id }, function(data) {
            Utils.trackGoogleEvent("NOTE_RESTORATION");
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
document.addEventListener('DOMContentLoaded', function() {
    if (location.href.indexOf('popup.html') !== -1) {
        // check params
        var params = new URLSearchParams(window.location.search);
        var mode = params.get("print");

        // initialize print if print mode else launch app
        if (mode == "true") {
            var model = new Model();
            model.initialize();
            var selectedId = model.getSelectedNoteId();
            if (selectedId) {
                try {
                    chrome.bookmarks.get(selectedId, function(arrayOfBookmarks) {
                        if (arrayOfBookmarks.length == 1) {
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
            var view = new View();
            view.initialize();
            setTimeout(function() {
                view.$el.find(".folder-search").removeAttr("disabled");
            }, 500);
        }

    }
}, false);
