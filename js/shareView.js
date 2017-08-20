var ShareView = {
    init: function init (height, width) {
        this.height = height;
        this.width = width;
        this.$el = $("<div>")
            .attr({
            "class" : "shareBtn"
            })
            .css({
            "background-image"  : "url('"+"./icons/share-icon.svg"+"')",
            "background-repeat" : "no-repeat",
            "height"            : this.height,
            "width"             : this.width,
            "margin-right"      : "10px",
            "cursor"            : "pointer"
        });
        this._noteId = null;
        this._active = false;
    },
    render: function render ($where, selectedId) {
        if ( this.$el && selectedId ) {
            this.$el.prependTo($where);
            ShareView.setSelectedNote(selectedId);
            this._active = true;
        }
    },
    setSelectedNote: function setSelectedNote (id) {
        this._noteId = id;
    },
    getSelectedNote: function getSelectedNote () {
        return this._noteId;
    },
    hide: function hide () {
        this.$el.hide();
        this._active = false;
    },
    show: function show () {
        this.$el.show();
        this._active = true;
    },
    showDilaog: function showDialog ($template, $where) {
        if ( !this._dialog ) {
            this._dialog = $template.dialog({
                autoOpen: false,
                appendTo: $where,
                modal: true,
                close: function() {

                }
            });
            this._dialog.dialog("open");
        }
        this._dialog.dialog("open");
    }
};