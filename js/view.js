
var parentBookmarkId = "0";

var View = function() {
    this.initialized = false;
    this.mode = "NOTES_ACTIVE";
    this.activeNotes_searchStr = "";
    this.inactiveNotes_searchStr = "";
    this.activeNotes = [];
    this.inactiveNotes = [];
    this.orderMap = localStorage['orderMap'] 
        && (typeof localStorage['orderMap'] === "string")
            && JSON.parse(localStorage['orderMap']) || {};
    this.content;
}
View.prototype.initialize = function() {
    if (this.initialized === true) return;
    this.initialized = true;

    this.$el = $("body");
    this.$textArea = this.$el.find("#notepad");
    
    this.model = new Model();
    
    var self = this;
    this.model.loadConfig(function(item) {
        var height = Number(item.size);
        height = height > 600 || !height ? 300 : height;
        self.$el.height(height);

        self.$textArea.css({
            "font-family": item.fontFamily,
            "font-size": item.fontSize
        });
    });

    //Load data from local storage
    this.model.load();

    this.model.reportSync(this.$el);

    if ( this.model.collapsed ) {
        this.$el.find(".rpanel").css({ width: "100%" });
        this.$el.find(".collapse-action").removeClass("collapse-arrow").addClass("expand-arrow");
    }


    this.$textArea.val(this.model.data && decodeURIComponent(Utils.encodeURIComponent(this.model.data.content)) || "").focus();
    var self = this;
    this.checkIfBookmarkExists("CuteNotepad", function (data) {
        //This means bookmark is found for this extension
        if (data) {

            self.model.bookmarkData = data;
            self.renderFolders(function (cuteNotepadChildren) {

                self.$el.find(".folder-name").eq(0).addClass("active");
                self.content = cuteNotepadChildren[0] && cuteNotepadChildren[0].url && cuteNotepadChildren[0].url.replace("data:text/plain;charset=UTF-8,", "") || "";
                self.$el.find("textarea").val(Utils.removeLineBreaks(self.content) || "").focus();

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

                    self.$textArea.focus();
                }
                self.checkIfBookmarkExists("trashedNotes", function (data) {
                    if (!data) {
                        //new subfolder: to hold deleted bookmarks
                        chrome.bookmarks.create({ "title": "trashedNotes", parentId: self.model.bookmarkData.id }, function (data) {
                            self.model.trashedFolderData = data;
                        });
                    } else {
                        self.model.trashedFolderData = data;
                    }
                });
            });
        } else {
            // todo google event new user
            //No bookmark found, hence create one
            chrome.bookmarks.create({ "title": "CuteNotepad" }, function (newFolder) {

                content = self.model.data && self.model.data.content || "";
                self.model.bookmarkData = newFolder;

                self.createNote(content, function (note) {
                    self.renderFolders(function (bookmarksTree) {
                        if (bookmarksTree && bookmarksTree[0]) {
                            self.model.selectedNoteId = note.id;
                        }
                        self.$el.find(".folder-name").eq(0).addClass("active");
                        self.$textArea.focus();

                        self.checkIfBookmarkExists("trashedNotes", function (data) {
                            if (!data) {
                                //new subfolder: to hold deleted bookmarks
                                chrome.bookmarks.create({ "title": "trashedNotes", parentId: self.model.bookmarkData.id }, function (data) {
                                    self.model.trashedFolderData = data;
                                    self.renderDeletedNotes(function () {});
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
View.prototype.save = function (content) {
    var self = this;
    clearTimeout(this.saveTimer);

    this.saveTimer = setTimeout(function () {

        if (content !== undefined && content !== self.model.data['content']) {
            self.model.data['content'] = Utils.encodePercentSymbol(content);
            self.model.updated = new Date().getTime();
            self.model.selectedNoteId = self.model.selectedNoteId;
            self.model.collapsed = self.model.collapsed;
            self.model.synced = +(new Date());
            self.model.deleted = false;
        }

        localStorage['data'] = JSON.stringify(self.model.data);

        chrome.bookmarks.update(self.model.selectedNoteId, {
            title: content.substr(0, 15) || "New Note",
            url: "data:text/plain;charset=UTF-8," + Utils.encodePercentSymbol(Utils.addLineBreaks(content))
        }, function () {
            self.renderFolders(function (bookmarksTree) {
                self.searchFolders(self.$el.find(".folder-search").val());
                self.hightlightSelected();
            });
        });
    }, 250);
}
View.prototype.renderFolders = function(cb) {
        var self = this;
        var title = "";

        self.activeNotes = [];
        self.inactiveNotes = [];
        chrome.bookmarks.getSubTree(this.model.bookmarkData.id, function (bookmarkTreeNodes) {
            
            self.$el.find('.folder-items').empty();
            
            var sortedChildren = bookmarkTreeNodes[0].children.sort(function (a, b) {
                //Means no children - if children then it means it is a trash notes folder
                if(!(a.children || b.children)) {
                    if (self.orderMap[a.id] && self.orderMap[b.id]) {
                        return self.orderMap[a.id].displayOrder - self.orderMap[b.id].displayOrder;
                    } else {
                        return 1;
                    }
                }
                
            });
            
            sortedChildren.forEach(function (item) {
                //No children means they are active notes. 
                if (!item.children) {
                    item.deleted = item.deleted ? item.deleted : false;
                    self.activeNotes.push(item);
                    title = item.title && item.title.substr(0, 15) || "New note";
                    self.$el.find('.folder-items').append("<div class = 'folder-name' data-bid = '" + item.id + "'>" + title + "</div>");
                } else {
                    self.inactiveNotes = item.children;
                }
            });
            self.hightlightSelected();
            self.$textArea.focus();
            cb && cb(bookmarkTreeNodes[0].children);
        });
};
View.prototype.newNoteInitiator = function (content) {
        var self = this;
        this.$textArea.val(decodeURIComponent(Utils.encodeURIComponent(content))).focus();

        this.createNote(content, function (note) {
            self.model.selectedNoteId = note.id;
            self.renderFolders(function () {
                this.$el.find(".folder-name").removeClass("active");
                this.$el.find(".folder-name[data-bid='" + self.model.selectedNoteId + "']").addClass("active");
                this.$textArea.focus();
                if (this.$el.find(".folder-name").length == 1) {
                    self.save(self.$textArea.val());
                }
            });
        });
};
View.prototype.createNote = function (content, cb) {
    var self = this;
    chrome.bookmarks.create({
        parentId: this.model.bookmarkData.id,
        title: content.substr(0, 15) || "New note",
        url: "data:text/plain;charset=UTF-8," + Utils.addLineBreaks(content)
    }, function (note) {
        self.model.selectedNoteId = note.id;
        cb && cb(note);
    });
}
View.prototype.hightlightSelected = function () {
        this.$el.find(".folder-name").removeClass("active");
        this.$el.find(".folder-name[data-bid='" + this.model.selectedNoteId + "']").addClass("active");
};
View.prototype.searchFolders = function(value) {
    var self = this;
    var subset;
    if (this.mode == "NOTES_ACTIVE") {
        this.activeNotes_searchStr = value;
        if ( value.trim() == "" ) {
            subset = this.activeNotes;
        } else {
            subset = this.activeNotes.filter(function (item) {
                return item.url.toLowerCase().indexOf(value.toLowerCase()) > 0 || item.title.toLowerCase().indexOf(value.toLowerCase()) > 0;
            });
        }

        this.$el.find('.folder-items').empty();

        subset.forEach(function (item) {
            var title = item.title && item.title.substr(0, 15) || "New note";
            self.$el.find('.folder-items').append("<div class = 'folder-name' data-bid = '" + item.id + "'>" + title + "</div>");
        });
    } else {
        self.inactiveNotes_searchStr = value;
        if ( value.trim() == "" ) {
            subset = this.inactiveNotes;
        } else {
            subset = this.inactiveNotes.filter(function (item) {
                return item.url.toLowerCase().indexOf(value.toLowerCase()) > 0 || item.title.toLowerCase().indexOf(value.toLowerCase()) > 0;
            });
        }

        this.$el.find('.trash').empty();

        subset.forEach(function (item) {
            var title = item.title && item.title.substr(0, 10);
            self.$el.find('.trash').append("<div class = 'deleted-note-name' data-bid = '" + item.id + "'><span>" + title + "</span><span class='actions'><span class='restore' title='Restore'></span><span class='delete' title='Delete Forever'></span></span></div>");
        });
    }
};
View.prototype.checkIfBookmarkExists = function(name, cb) {
    var bookmarkTreeNodes = chrome.bookmarks.search(name, function (bookmarkTreeNodes) {
        cb(bookmarkTreeNodes[0]);
    });
};
View.prototype.updateDisplayOrder = function() {
    this.orderMap = {};
    var self = this;
    this.$el.find(".folder-name").each(function (iter, item) {
        self.orderMap[item.getAttribute("data-bid")] = {
            displayOrder: iter
        }
    });
    Utils.trackGoogleEvent("NOTE_REORDERED");
    localStorage['orderMap'] = JSON.stringify(this.orderMap);
}
View.prototype.loadNotebyId = function (bookmarkId, preview) {
    var self = this;
    if (preview) {
        chrome.bookmarks.getSubTree(this.model.trashedFolderData.id, function (bookmarkTreeNodes) {
            var bookmark = bookmarkTreeNodes[0].children.filter(function (item) {
                return item.id === bookmarkId;
            });

            var content = bookmark[0] && bookmark[0].url || "";
            content = content.replace("data:text/plain;charset=UTF-8,", "");
            content = Utils.removeLineBreaks(content);
            self.$el.find(".trash-note-preview").html(content);
        });
    } else {
        chrome.bookmarks.getSubTree(this.model.bookmarkData.id, function (bookmarkTreeNodes) {
            var bookmark = bookmarkTreeNodes[0].children.filter(function (item) {
                return item.id === bookmarkId;
            });

            var content = bookmark[0] && bookmark[0].url || "";
            content = content.replace("data:text/plain;charset=UTF-8,", "");
            content = Utils.removeLineBreaks(content);
            self.$textArea.val(content).focus();
        });
    }
};
View.prototype.upsertSelectedNote = function () {
    try {
        this.model.data.selectedNoteId = this.model.selectedNoteId;
    }
    catch (e) {
        console.info("Error " + e.message);
    }
    localStorage['data'] = JSON.stringify(this.model.data);
};
View.prototype.upsertCollapse = function () {
    try {
        this.model.data.collapsed = this.model.collapsed;
    }
    catch (e) {
        console.info("Error " + e.message);
    }
    localStorage['data'] = JSON.stringify(this.model.data);
};
View.prototype.renderDeletedNotes = function (cb) {
    var self = this;
    chrome.bookmarks.getSubTree(this.model.trashedFolderData.id, function (data) {
        self.$el.find('.trash').empty();
        var trashList = data[0].children;
        trashList.forEach(function (item) {
            title = item.title && item.title.substr(0, 10);
            self.$el.find('.trash').append("<div class = 'deleted-note-name' data-bid = '" + item.id + "'><span>" + title + "</span><span class='actions'><span class='restore' title='Restore'></span><span class='delete' title='Delete Forever'></span></span></div>");
        });
        cb && cb();
    });
};
View.prototype.bindEvents = function() {
        var self = this;
        this.$textArea.on("keyup", function () {
            self.save(self.$textArea.val());
        });

        this.$el.find(".newNoteBtn").on("click", function () {
            self.content = "";
            self.$textArea.val("").focus();

            chrome.bookmarks.create({
                parentId: self.model.bookmarkData.id,
                title: "New Note",
                url: "data:text/plain;charset=UTF-8,"
            }, function (data) {
                self.model.selectedNoteId = data.id;
                self.renderFolders(function () {
                    self.hightlightSelected();
                });
            });

            Utils.trackGoogleEvent("NOTE_CREATION");
        });

        this.$el.find(".collapse-action").on("click", function () {
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

        this.$el.find(".folderMenu").delegate(".folder-name", "click", function () {
            var $this = $(this);
            $(".folder-name").removeClass("active");
            $this.addClass("active");
            self.model.selectedNoteId = $this.attr("data-bid");
            self.loadNotebyId($this.attr("data-bid"), false);
            self.upsertSelectedNote();
        });

        this.$el.find(".delete-action").on("click", function () {

            // Get the next in order note's bookmark id, so that we make that active 
            var nextNoteId = self.$el.find(".folder-items .folder-name[data-bid=" + self.model.selectedNoteId + "]").next().attr("data-bid");
            self.$textArea.val("");

            chrome.bookmarks.move(self.model.selectedNoteId, { parentId: self.model.trashedFolderData.id }, function (data) {

                Utils.trackGoogleEvent("NOTE_SOFT_DELETION");

                self.renderFolders(function (bookmarksTree) {

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

        this.$el.find(".trashed").click(function () {
            self.$el.find(".folder-search").val("");
            self.$el.find(".trashed").toggleClass("active");
            if (!self.$el.find(".trash").hasClass("expanded")) {
                Utils.trackGoogleEvent("NOTE_BIN_VISITED");
                self.mode = "NOTES_INACTIVE";
                self.$el.find(".delete-action, .newNoteBtn, .collapse-action, .folder-items").hide();
                self.$el.find(".trash").addClass("expanded").show();

                self.renderDeletedNotes();
                self.$el.find(".trash-note-preview").show();
            } else {
                self.$el.find(".trash").removeClass("expanded").hide();
                self.mode = "NOTES_ACTIVE";
                self.$el.find(".trash").html("");
                self.$el.find(".trash-note-preview").hide();
                self.$el.find(".delete-action, .newNoteBtn, .collapse-action, .folder-items").show();
                self.renderFolders();
            }
        });

        this.$el.find(".folder-search").keyup(function (evt) {
            var $this = $(this);
            var value = $this.val().trim();

            self.searchFolders(value);
        });

        this.$el.find(".trash").delegate(".deleted-note-name", "click", function (event) {
            self.$el.find(".deleted-note-name").removeClass("active");
            $(event.currentTarget).addClass("active");
            var noteId = $(this).attr("data-bid");
            if (noteId) {
                self.loadNotebyId(noteId, true);
            }
        });

        this.$el.find(".trash").delegate(".deleted-note-name .restore", "click", function () {
            var $toRestore = $(this).parents(".deleted-note-name");
            var noteId = $toRestore.attr("data-bid");
            $(".trash-note-preview").html("");
            $toRestore.remove();

            chrome.bookmarks.move(noteId, { parentId: self.model.bookmarkData.id }, function (data) {
                Utils.trackGoogleEvent("NOTE_RESTORATION");
                title = data.title && data.title.substr(0, 15);
                $('.folder-items').append("<div class = 'folder-name' data-bid = '" + data.id + "'>" + title + "</div>");
            });
        });

        this.$el.find(".trash").delegate(".deleted-note-name .delete", "click", function () {
            var $noteToDelete = $(this).parents(".deleted-note-name");
            var noteId = $noteToDelete.attr("data-bid");
            chrome.bookmarks.remove(noteId, function () {
                Utils.trackGoogleEvent("NOTE_HARD_DELETION");
                self.$el.find(".trash-note-preview").html("");
                $noteToDelete.remove();
            })
        });

        //Sortable Notes down below here
        this.$el.find(".folder-items").sortable({
            tolerance: "pointer",
            containment: "parent",
            update: function (event, ui) {
                var ele = $(ui);
                self.updateDisplayOrder();
            }
        });
};
document.addEventListener('DOMContentLoaded', function () {
    if (location.href.indexOf('popup.html') !== -1) {
        var view = new View();
        view.initialize();
        view.$el.find("textarea").focus();
        setTimeout(function () {
            view.$el.find(".folder-search").removeAttr("disabled");
        }, 500)
    }
}, false);
// document.addEventListener('DOMContentLoaded', function () {
//     $("textarea").focus();
//     setTimeout(function () {
//         $(".folder-search").removeAttr("disabled")
//     }, 500)
// }, false);


// if (location.href.indexOf('popup.html') !== -1) {
//     Ext.initialize();
// }


// var template = '<div class="folderMenu">'+
// '<input disabled = "disabled" type="text" class = "folder-search search" placeholder="Search Notes.."/>'+
// '<div class="folder-items"></div>'+
// 			'<div class="trash"></div><div class="btn trashed"><div>Recycle Bin</div></div></div>'+
// 		'<div class="rpanel"><div class="header-strip"><div class = "collapse-action collapse-arrow"></div>'+
//             '<div class = "right-actions"><div class="delete-action"></div><div class = "btn newNoteBtn">New Note</div></div></div>'+
			
// 			'<div class="content-display"><textarea autofocus = "true" id = "notepad" placeholder="Write something here !!" wrap="hard"></textarea>'+
// 				'<div class="trash-note-preview"></div></div>'+
// 			'<div class="footer-strip"><a class="settings" title="Settings" href = "" target="_blank"></a>'+
// 				'<div style="opacity: 0.3;">Last synchronization on : <span class="sync"></span></div></div>'+
			
// 		'</div>';
