var Model = function() {
    this.data;
    this.bookmarkData;
    this.trashedFolderData;
    this.selectedNoteId;
    this.collapsed;
}
Model.prototype.initialize = function() {
    this.load();
}
Model.prototype.loadConfig = function(cb) {
    chrome.storage.sync.get({
            fontSize: "14px",
            fontFamily: "default",
            size: 300
        }, function (item) {
            cb(item);
        });
}
Model.prototype.load = function() {
    if (localStorage['data']) {
        try {
            this.data = JSON.parse(localStorage['data']);
            //this.selectedNote = this.data;
            this.selectedNoteId = this.data.selectedNoteId;
            this.collapsed = this.data.collapsed;
        } catch (ex) {
            this.data = null;
        }
    }

    // Initialize this.data
    if (!this.data) {
        this.data = {
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
    if (!this.data.options) {
        this.data.options = {
            'sync': true
        }
    }
    return this;
}
Model.prototype.reportSync = function(el) {

    el.find(".sync").html(Utils.getDT(this.data.synced));
}
Model.prototype.getSelectedNoteId = function() {
    return this.selectedNoteId;
}
