
var parentBookmarkId = "0";


Ext = {

	initialized : false,
	
	initialize  : function() {
		var self = this;
        var content;

		if(this.initialized === true) return;

        this.initialized = true;
        this.mode = "NOTES_ACTIVE";
        this.activeNotes_searchStr = "";
        this.inactiveNotes_searchStr = "";
        this.loadConfig();
        this.$textArea   = $("#notepad");

        //Load data from local storage
        this.load();

        this.reportSync();

        if(self.collapsed) {
            $(".rpanel").css({width : "100%"});
            $(".collapse-action").removeClass("collapse-arrow").addClass("expand-arrow");
        }


		this.$textArea.val(this.data && decodeURIComponent(this.data.content) || "").focus();

        this.checkIfBookmarkExists("CuteNotepad",function(data) {

            //This means bookmark is found for this extension
            if(data) {

                self.bookmarkData = data;
                self.renderFolders(function(cuteNotepadChildren) {

                    $(".folder-name").eq(0).addClass("active");
                    content = cuteNotepadChildren[0] && cuteNotepadChildren[0].url && cuteNotepadChildren[0].url.replace("data:text/plain;charset=UTF-8,", "") || "";
                    $("textarea").val(self.removeLineBreaks(content) || "").focus();

                    if(!cuteNotepadChildren.length) {
                        //Means there is a Root bookmark but no notes. So lets create one note:
                        content = this.data && this.data.content || "";
                        self.newNoteInitiator(content);

                    } else {

                        if($(".folder-name[data-bid='"+self.selectedNoteId+"']").length) {
                            $(".folder-name[data-bid='"+self.selectedNoteId+"']").trigger("click");
                        } else {
                            self.selectedNoteId = cuteNotepadChildren[0].id;
                            $(".folder-name[data-bid='"+self.selectedNoteId+"']").trigger("click");
                        }

                        $("textarea").focus();
                    }
                    self.checkIfBookmarkExists("trashedNotes", function(data) {
                        if ( !data ) {
                            //new subfolder: to hold deleted bookmarks
                            chrome.bookmarks.create({"title": "trashedNotes", parentId: self.bookmarkData.id}, function(data){
                                self.trashedFolderData = data;
                                /*self.renderDeletedNotes(function(){

                                });*/
                            });
                        } else {
                            self.trashedFolderData = data;
                            /*self.renderDeletedNotes(function(){

                            });*/
                        }
                    });

                });

            } else {

                //No bookmark found, hence create one
                chrome.bookmarks.create({"title" : "CuteNotepad"}, function(newFolder) {

                    content = self.data && self.data.content || "";
                    self.bookmarkData = newFolder;
                    self.createNote(content, function(note) {

                        self.renderFolders(function (bookmarksTree) {
                            if(bookmarksTree && bookmarksTree[0]) {

                                self.selectedNoteId = note.id;
                            }
                            $(".folder-name").eq(0).addClass("active");
                            $("textarea").focus();


                            self.checkIfBookmarkExists("trashedNotes", function(data) {
                                if ( !data ){
                                    //new subfolder: to hold deleted bookmarks
                                    chrome.bookmarks.create({"title": "trashedNotes", parentId: self.bookmarkData.id}, function(data){
                                        self.trashedFolderData = data;
                                        self.renderDeletedNotes(function(){

                                        });
                                    });
                                } else {
                                    self.trashedFolderData = data;
                                }
                            });
                        });
                    });

                });
            }

        });

        this.bindEvents();
	},

    loadConfig : function() {
        chrome.storage.sync.get({
            fontSize: "14px",
            fontFamily: "default"
        }, function(item) {

            $("textarea").css({
                "font-family" : item.fontFamily,
                "font-size" : item.fontSize
            })
        });
    },

    hightlightSelected : function () {
        var self = this;
        $(".folder-name").removeClass("active");
        $(".folder-name[data-bid='"+self.selectedNoteId+"']").addClass("active");
    },

    trackGoogleEvent : function() {
        _gaq.push(['_trackEvent', "NoteCreated", 'clicked', "NoteCreated"]);
    },

    bindEvents : function() {
        var self = this;
        this.$textArea.on("keyup", function() {
            self.save(self.$textArea.val());
        });

        $(".newNoteBtn").on("click", function() {
            var content = "";
            $("textarea").val("").focus();
            chrome.bookmarks.create({
                    parentId: self.bookmarkData.id,
                    title : "New Note",
                    url : "data:text/plain;charset=UTF-8,"
            }, function (data) {
                self.selectedNoteId = data.id;
                self.renderFolders(function() {
                    self.hightlightSelected();
                });
            });

            self.trackGoogleEvent();
        });

        $(".collapse-action").on("click", function() {
            var $this = $(this);
            if($this.hasClass("expand-arrow")) {
                $this.removeClass("expand-arrow").addClass("collapse-arrow");
                $(".rpanel").animate({width : "620px"});
                self.collapsed = false;
            } else {
                $this.removeClass("collapse-arrow").addClass("expand-arrow");
                $(".rpanel").animate({width : "100%"});
                self.collapsed = true;
            }
            self.upsertCollapse();
        });

        $(".folderMenu").delegate(".folder-name", "click", function () {
            var $this = $(this);
            $(".folder-name").removeClass("active");
            $this.addClass("active");
            self.selectedNoteId = $this.attr("data-bid");
            self.loadNotebyId($this.attr("data-bid"), false);
            self.upsertSelectedNote();
        });

        $(".delete-action").on("click", function() {

            // Get the next in order note's bookmark id, so that we make that active 
            var nextNoteId = $(".folder-items .folder-name[data-bid="+self.selectedNoteId+"]").next().attr("data-bid");
            $("textarea").val("");
            chrome.bookmarks.move(self.selectedNoteId, {parentId:self.trashedFolderData.id}, function(data){
               
               self.renderFolders(function (bookmarksTree) {

                    var $next;

                    if ( !nextNoteId && $(".folder-items .folder-name").length ) {
                        /*  The case when nextNode wasn't available because it was the last in list
                            make the first one active in that case
                        */
                        $next = $(".folder-items .folder-name").eq(0);
                        nextNoteId = $next.attr("data-bid");
                    } else if ( !nextNoteId && !$(".folder-items .folder-name").length ) {
                        /*  The case when no more active notes are present 
                        */
                        self.newNoteInitiator("");
                    } else {
                        $next = $(".folder-items .folder-name[data-bid="+nextNoteId+"]");
                    }
                    if ( $next ) {
                        $next.addClass("active");
                        self.selectedNoteId = nextNoteId;
                        self.loadNotebyId(self.selectedNoteId);
                        self.upsertSelectedNote();
                    }
                        
                });
            });
        });

        $(".trashed").click(function(){
            $(".folder-search").val("");
            $(".trashed").toggleClass("active");
            if ( !$(".trash").hasClass("expanded") ) {
                self.mode = "NOTES_INACTIVE";
                $(".trash").addClass("expanded");
                $(".delete-action, .newNoteBtn, .collapse-action").hide();
                self.renderDeletedNotes();
                $(".trash-note-preview").show();
            } else {
                $(".trash").removeClass("expanded");
                self.mode = "NOTES_ACTIVE";
                $(".trash").html("");
                $(".trash-note-preview").hide();
                $(".delete-action, .newNoteBtn, .collapse-action").show();
                self.renderFolders();
            }
        });

        $(".folder-search").keyup(function(evt) {
            var $this = $(this);
            var value = $this.val().trim();

            self.searchFolders(value);
        });

        $(".trash").delegate(".deleted-note-name", "click", function(event) {
            $(".deleted-note-name").removeClass("active");
            $(event.currentTarget).addClass("active");
            var noteId = $(this).attr("data-bid");
            if ( noteId ) {
                self.loadNotebyId(noteId, true);   
            }
        });

        $(".trash").delegate(".deleted-note-name .restore", "click", function() {
            var $toRestore = $(this).parents(".deleted-note-name");
            var noteId = $toRestore.attr("data-bid");
            $(".trash-note-preview").html("");
            $toRestore.remove();

            chrome.bookmarks.move(noteId, {parentId:self.bookmarkData.id}, function(data){
                title = data.title && data.title.substr(0, 15);
                $('.folder-items').append("<div class = 'folder-name' data-bid = '"+data.id+"'>"+title+"</div>");
            });
        });

        $(".trash").delegate(".deleted-note-name .delete", "click", function(){
            var $noteToDelete = $(this).parents(".deleted-note-name");
            var noteId = $noteToDelete.attr("data-bid");
            chrome.bookmarks.remove(noteId, function() {
                $(".trash-note-preview").html("");
                $noteToDelete.remove();
            })
        });
    },

    searchFolders : function(value) {
        var self = this;
        var subset;
        if ( this.mode == "NOTES_ACTIVE") {
            self.activeNotes_searchStr = value;
            subset = self.activeNotes.filter(function(item) {
                return ~item.url.toLowerCase().indexOf(value.toLowerCase()) || ~item.title.toLowerCase().indexOf(value.toLowerCase());
            });

            $('.folder-items').empty();

            subset.forEach(function(item) {
                var title = item.title && item.title.substr(0, 15) || "New note";
                $('.folder-items').append("<div class = 'folder-name' data-bid = '"+item.id+"'>"+title+"</div>");
            });
        } else {
            self.inactiveNotes_searchStr = value;
            subset = self.inactiveNotes.filter(function(item) {
                return ~item.url.toLowerCase().indexOf(value.toLowerCase()) || ~item.title.toLowerCase().indexOf(value.toLowerCase());
            });

            $('.trash').empty();

            subset.forEach(function(item) {
                var title = item.title && item.title.substr(0, 15);
                $('.trash').append("<div class = 'deleted-note-name' data-bid = '"+item.id+"'><span>"+title+"</span><span class='actions'><span class='restore' title='Restore'></span><span class='delete' title='Delete Forever'></span></span></div>");
            });
        }
    },
    createNote : function(content, cb) {
        var self = this;
        chrome.bookmarks.create({
            parentId    : self.bookmarkData.id,
            title       :  content.substr(0, 15) || "New note",
            url         : "data:text/plain;charset=UTF-8," + self.addLineBreaks(content)        
        }, function(note) {
            self.selectedNoteId = note.id;
            cb && cb(note);
        });
    },


    checkIfBookmarkExists : function(name, cb) {
        var bookmarkTreeNodes = chrome.bookmarks.search(name, function (bookmarkTreeNodes) {
            cb(bookmarkTreeNodes[0]);
        });

    },

    loadNotebyId : function(bookmarkId, preview) {
        var self = this;
        if ( preview ) {
            chrome.bookmarks.getSubTree(self.trashedFolderData.id, function(bookmarkTreeNodes) {
                var bookmark = bookmarkTreeNodes[0].children.filter(function(item) {
                    return item.id === bookmarkId;
                });

                var content = bookmark[0] && bookmark[0].url || "";
                    content = content.replace("data:text/plain;charset=UTF-8,", "");
                    content = self.removeLineBreaks(content);
                    $(".trash-note-preview").html(content);
            });
        } else {
            chrome.bookmarks.getSubTree(self.bookmarkData.id, function(bookmarkTreeNodes) {
                var bookmark = bookmarkTreeNodes[0].children.filter(function(item) {
                    return item.id === bookmarkId;
                });

                var content = bookmark[0] && bookmark[0].url || "";
                    content = content.replace("data:text/plain;charset=UTF-8,", "");
                    content = self.removeLineBreaks(content);
                    $("textarea").val(content).focus();
            });
        }
            
    },


    renderFolders : function(cb) {
        var self = this;
        var title = "";
        chrome.bookmarks.getSubTree(this.bookmarkData.id, function(bookmarkTreeNodes) {
            $('.folder-items').empty();
            self.activeNotes = [];
            self.inactiveNotes = [];
            bookmarkTreeNodes[0].children.forEach(function(item) {
                if ( !item.children ) {
                    item.deleted = item.deleted ? item.deleted : false;
                    self.activeNotes.push(item);
                    title = item.title && item.title.substr(0, 15) || "New note";
                    $('.folder-items').append("<div class = 'folder-name' data-bid = '"+item.id+"'>"+title+"</div>");
                } else {
                    self.inactiveNotes = item.children;
                }
            });
            self.hightlightSelected();
            $("textarea").focus();
            cb && cb(bookmarkTreeNodes[0].children);
        });
    },

    renderDeletedNotes: function(cb){
        var self = this;
        chrome.bookmarks.getSubTree(this.trashedFolderData.id, function(data) {
            $('.trash').empty();
            var trashList = data[0].children;
            trashList.forEach(function(item){
                title = item.title && item.title.substr(0, 15);
                $('.trash').append("<div class = 'deleted-note-name' data-bid = '"+item.id+"'><span>"+title+"</span><span class='actions'><span class='restore' title='Restore'></span><span class='delete' title='Delete Forever'></span></span></div>"); 
            });
            cb && cb();
        });
        
        
    },

    newNoteInitiator: function(content) {
        var self = this;
        $("textarea").val(decodeURIComponent(content)).focus();

        this.createNote(content, function(note) {
            self.selectedNoteId = note.id;
            self.renderFolders(function() {
                $(".folder-name").removeClass("active");
                $(".folder-name[data-bid='"+self.selectedNoteId+"']").addClass("active");
                $("textarea").focus();
                if ( $(".folder-name").length == 1 ) {
                    self.save(self.$textArea.val());
                }
            });
        });
    },

    removeLineBreaks : function(inStr) {
        return decodeURIComponent(inStr.replace(/<br \/>/g, "\n"));
    },

    addLineBreaks : function(inStr) {
        return inStr.replace(/\r\n?|\n/g, "<br />");
    },
    //Saves data to Bookmarks
    save : function(content) {

        var self = this;
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(function() {

            if(content !== undefined && content !== self.data['content']) {
                self.data['content'] 	= content;
                self.data.updated 		= new Date().getTime();
                self.data.selectedNoteId  = self.selectedNoteId;
                self.data.collapsed = self.collapsed;
                self.data.synced  = +(new Date());
                self.data.deleted = false;
            }

            localStorage['data'] 	= JSON.stringify(self.data);

            chrome.bookmarks.update(self.selectedNoteId, {
                title : content.substr(0, 15) || "New Note",
                url   : "data:text/plain;charset=UTF-8," + self.addLineBreaks(content)
            }, function() {
                self.renderFolders(function (bookmarksTree) {
                    self.searchFolders($(".folder-search").val());
                    self.hightlightSelected();
                });
            });


        }, 500);

    },
    upsertSelectedNote : function() {
        try {
            this.data.selectedNoteId = this.selectedNoteId;
        }
        catch(e) {
            console.info("Error "+ e.message);
        }
        localStorage['data'] 	= JSON.stringify(this.data);
    },
    upsertCollapse : function() {
        try {
            this.data.collapsed = this.collapsed;
        }
        catch(e) {
            console.info("Error "+ e.message);
        }
        localStorage['data'] 	= JSON.stringify(this.data);
    },
	load : function() {
		if(localStorage['data']) {
			try {
				this.data = JSON.parse(localStorage['data']);
                //this.selectedNote = this.data;
                this.selectedNoteId = this.data.selectedNoteId;
                this.collapsed = this.data.collapsed;
			} catch(ex) {
				this.data = null;
			}
		}

		// Initialize this.data
		if(!this.data) {
			this.data = {
				'content'	: '',

				'selection' : {
					'start'	: 0,
					'end'	: 9
				},

				'scroll'	: {
					'left'	: 0,
					'top'	: 0
				},

				'size'		: {
					'width'	: 100,
					'height': 80
				},
				'options'	: {
					'sync'	: true
				}
			}
		}

		if(!this.data.options) {
			this.data.options = {
				'sync' : true
			}
		}


		return this;
	},

	reportSync : function() {
        $(".sync").html(this.getDT(this.data.synced))
	},

    getDT : function(timestamp) {

        var string = 'N/A';
        var days, hours, minutes, seconds, diff;

        if(timestamp) {
            diff = Math.round( (new Date().getTime() - timestamp) / 1000 ),
                hours = Math.round(diff/3600);

            if( diff == 0) {
                string = 'Just now'
            } else if( diff  < 60  ) {
                string = diff+ ' second' + (diff > 1 ? 's' : '') + ' ago'
            } else if (diff > 60 && diff < 3600) {
                minutes 	= Math.round(diff/60);
                seconds 	= diff % 60;
                string	 	= Math.round(diff / 60) + ' minute'+(Math.round(diff / 60) > 1 ? 's' : '')+' ago';
            } else if (diff > 3600 && hours < 48) {
                string 		= hours + ' hour'  + (hours > 1 ? 's' : '') + ' ago';
            } else {
                string 		= 'Long time ago'
            }
        }

        return string;
    },

}
document.addEventListener('DOMContentLoaded', function() {
    $("textarea").focus();
    setTimeout(function() {
        $(".folder-search").removeAttr("disabled")
    },500)
}, false);


if(location.href.indexOf('popup.html') !== -1) {
    Ext.initialize();
}


