function Actions() {
    this.$el = $(".notepad-action-menu");
    this.bindEvents();
}
Actions.prototype.bindEvents = function() {
    var self = this;
    this.$el.find(".print-btn").click(self.print.bind(this));
    this.$el.find(".download-btn-text").click(function() {
        var content = self.getContent("text");
        self.download(content, "Chrome Notepad", "text/plain");
    });
    this.$el.find(".download-btn-html").click(function() {
        var content = self.getContent("html");
        self.download(content, "Chrome Notepad", "text/html");
    });
};
Actions.prototype.setNoteId = function(noteId) {
    this.noteId = noteId;
};
Actions.prototype.show = function() {
    try {
        this.$el.toggle();
        this.$el.position({
            of: $(".actionsBtn"),
            my: "right+10 top+10",
            at: "center bottom",
            collision: "flip flip"
        });
    } catch (e) {
        console.log("Error");
    }
};
Actions.prototype.hide = function() {
    this.$el.hide();
};
Actions.prototype.getContent = function(type) {
    if (type === "text") {
        var value = tinymce.activeEditor.getContent({ format: 'text' });
    } else {
        var value = tinymce.activeEditor.getContent();
    }
    return value;
}
Actions.prototype.print = function() {
    Utils.trackGoogleEvent("NOTE_PRINTED");
    chrome.tabs.create({ url: window.location.href + "?print=true" });
};

Actions.prototype.download = function(text, name, type) {
    var a = document.createElement("a");
    if (type === "text/plain") {
        var file = new Blob([text], { type: type });
        a.href = window.URL.createObjectURL(file);
    } else if (type === "text/html") {
        a.href = "data:text/html," + text;
    }
    a.download = name;
    a.click();
    Utils.trackGoogleEvent("NOTE_DOWNLOADED");
};
