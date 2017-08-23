function Actions() {
	this.$el = $(".action-menu");
	this.bindEvents();
}
Actions.prototype.bindEvents = function() {
	var self = this;
	this.$el.find(".print-btn").click(self.print.bind(this));
	this.$el.find(".download-btn").click(function() {
        var content = self.getContent();
		self.download(content, "Chrome Notepad","text/plain");
	});
};
Actions.prototype.setNoteId = function(noteId) {
	this.noteId = noteId;
};
Actions.prototype.show = function() {
	this.$el.toggle();
	this.$el.position({
		of: $(".actionsBtn"),
		my: "right+10 top+10",
		at: "center bottom",
		collision: "flip flip"
	});
};
Actions.prototype.hide = function() {
	this.$el.hide();
};
Actions.prototype.getContent = function() {
    var value = document.getElementById("notepad").value;
	value = value.replace("data:text/plain;charset=UTF-8,", "");
	return value;
}
Actions.prototype.print = function() {
	var left = screen.width / 2 - 800 / 2;
	var top = screen.height / 2 - 600 / 2;
	
	var mywindow = window.open(
		"",
		"PRINT",
		"height=600,width=800,top=" + top + ",left=" + left + ""
	);
	
	mywindow.document.write("<html><head><title></title>");
	mywindow.document.write("</head><body >");
	mywindow.document.write(Utils.addLineBreaks(this.getContent()));
	mywindow.document.write("</body></html>");

	mywindow.document.close(); // necessary for IE >= 10
	mywindow.focus(); // necessary for IE >= 10*/
	
	mywindow.print();
	mywindow.close();
	return true;
};

Actions.prototype.download = function(text, name, type) {
	var a = document.createElement("a");
	var file = new Blob([text], { type: type });
	a.href = window.URL.createObjectURL(file);
	a.download = name;
	a.click();
};
