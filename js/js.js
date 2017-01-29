
var parentBookmarkId = "0";


Ext = {

	initialized : false,
	
	initialize  : function() {
		var self = this;
        var content;

		if(this.initialized === true) return;

        this.initialized = true;

        this.loadConfig();
        this.$textArea   = $("#notepad");

        //Load data from local storage
        this.load();

        this.reportSync();

        if(self.collapsed) {
            $(".rpanel").css({width : "100%"});
            $(".collapse-action").removeClass("collapse-arrow").addClass("expand-arrow");
        }


		this.$textArea.val(this.data && this.data.content || "");

        this.checkIfBookmarkExists("CuteNotepad",function(data) {

            //This means bookmark is found for this extension
            if(data) {

                self.bookmarkData = data;
                self.renderFolders(function(bookmarkTree) {

                    $(".folder-name").eq(0).addClass("active");
                    content = bookmarkTree[0] && bookmarkTree[0].url && bookmarkTree[0].url.replace("data:text/plain;charset=UTF-8,", "") || "";
                    $("textarea").val(self.removeLineBreaks(content) || "");

                    if(!bookmarkTree.length) {
                        //Means there is a Root bookmark but no notes. So lets create one note:
                        content = self.data && self.data.content || "";
                        $("textarea").val(content);

                        self.createNote(content, function(note) {
                            self.selectedNoteId = note.id;
                            self.renderFolders(function() {
                                $(".folder-name[data-bid='"+self.selectedNoteId+"']").addClass("active");
                                $("textarea").focus();
                            });
                        });

                    } else {

                        if($(".folder-name[data-bid='"+self.selectedNoteId+"']").length) {
                            $(".folder-name[data-bid='"+self.selectedNoteId+"']").trigger("click");
                        } else {
                            self.selectedNoteId = bookmarkTree[0].id;
                            $(".folder-name[data-bid='"+self.selectedNoteId+"']").trigger("click");
                        }

                        $("textarea").focus();
                    }

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
            $("textarea").val("");
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
            self.loadNotebyId($this.attr("data-bid"));
        });

        $(".delete-action").on("click", function() {
            chrome.bookmarks.remove(self.selectedNoteId, function() {
                console.log("Note Deleted");
                self.renderFolders(function(children) {
                    if(children.length) {
                        //Means we have more notes, so we can bow focus on the first one
                        $(".folder-name").eq(0).trigger("click");
                    } else {
                        //No Notes found. No lets create a default one.
                        self.createNote("", function() {
                            self.renderFolders(function() {

                            });
                            $("textarea").val("");
                        });

                    }
                });
            })
        });

        $(".folder-search").keyup(function(evt) {
            var $this = $(this);
            var value = $this.val().trim();

            self.searchFolders(value);
        });

    },

    searchFolders : function(value) {
        var self = this;
        var subset = self.children.filter(function(item) {
            return ~item.url.toLowerCase().indexOf(value.toLowerCase()) || ~item.title.toLowerCase().indexOf(value.toLowerCase());
        });

        $('.folder-items').empty();

        subset.forEach(function(item) {
            var title = item.title && item.title.substr(0.15) || "New note";
            $('.folder-items').append("<div class = 'folder-name' data-bid = '"+item.id+"'>"+title+"</div>");
        });
    },
    createNote : function(content, cb) {
        var self = this;
        chrome.bookmarks.create({
            parentId : self.bookmarkData.id,
            title :  content.substr(0, 15) || "New note",
            url : "data:text/plain;charset=UTF-8," + self.addLineBreaks(content)
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

    loadNotebyId : function(bookmarkId) {
        var self = this;
        chrome.bookmarks.getSubTree(this.bookmarkData.id, function(bookmarkTreeNodes) {

            var bookmark = bookmarkTreeNodes[0].children.filter(function(item) {
                return item.id === bookmarkId;
            });

            var content = bookmark[0] && bookmark[0].url || "";
                content = content.replace("data:text/plain;charset=UTF-8,", "");
                content = self.removeLineBreaks(content);
            $("textarea").val(content);
        });
    },


    renderFolders : function(cb) {
        var self = this;
        var title = "";
        chrome.bookmarks.getSubTree(this.bookmarkData.id, function(bookmarkTreeNodes) {
            $('.folder-items').empty();
            self.children = bookmarkTreeNodes[0].children;
            bookmarkTreeNodes[0].children.forEach(function(item) {
                title = item.title && item.title.substr(0.15) || "New note";
                $('.folder-items').append("<div class = 'folder-name' data-bid = '"+item.id+"'>"+title+"</div>");
            });
            self.hightlightSelected();
            cb && cb(bookmarkTreeNodes[0].children);
        });
    },
    removeLineBreaks : function(inStr) {
        return inStr.replace(/<br \/>/g, "\n");
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
            }

            localStorage['data'] 	= JSON.stringify(self.data);

            chrome.bookmarks.update(self.selectedNoteId, {
                title : content.substr(0, 15) || "New Note",
                url   : "data:text/plain;charset=UTF-8," + self.addLineBreaks(content)
            }, function() {
                console.log("Updated Note");
                self.renderFolders(function (bookmarksTree) {
                    self.searchFolders($(".folder-search").val());
                    self.hightlightSelected();
                });
            });


        }, 500);

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


window.onload = function () {
    $(".folder-name").eq(0).addClass("active");
};

if(location.href.indexOf('popup.html') !== -1) {
    Ext.initialize();
}


