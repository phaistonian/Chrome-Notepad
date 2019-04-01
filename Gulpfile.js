const gulp = require('gulp');
const bump = require('gulp-bump');
const zip = require('gulp-zip');
const fs = require('fs');
const path = require('path');
const rimraf = require('gulp-rimraf');
const rename = require('gulp-rename');
const cheerio = require('gulp-cheerio');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var del = require('del');
const babel = require('gulp-babel');


const getPackageJson = function () {
  return JSON.parse(fs.readFileSync('./manifest.json', 'utf8'));
};

gulp.task('bump', () => gulp.src('./manifest.json')
  .pipe(bump({ type: 'patch' }))
  .pipe(gulp.dest('./')));

gulp.task('remove', cb => {
  gulp.src('./Chrome Notepad*.zip', { read: false }) // much faster
    .pipe(rimraf());

  cb();
});

function clean(cb) {
    del(['dist']);
    cb();
}

gulp.task('concat', function() {
  return gulp.src(
    ["./js/ga.js", "./js/jquery.min.js", 
    "./js/jquery-ui.min.js", "./tinymce/js/tinymce/tinymce.min.js", "./js/utils.js", 
    "./js/model.js", "./js/actions.js",
    "./js/shareView.js", "./js/view.js"]
  )
    .pipe(babel({
      presets: ['@babel/env']
    })) 
    .pipe(concat('dist.js'))
    .pipe(gulp.dest('./dist/'));
});

gulp.task('compress', function (cb) {
  gulp.src('./dist/dist.js')
      .pipe(uglify())
      .pipe(gulp.dest('./dist/'));

   cb();  
});

gulp.task('zip', cb => {
  gulp.src([
    './css/**',
    './icons/**',
    './js/**',
    './dist/**',
    './manifest.json',
    './background.js',
    './options.html',
    './popup.html',
  ], { base: '.' })
    .pipe(zip(`Chrome Notepad ${getPackageJson().version.replace(/\./gi, '-')}.zip`))
    .pipe(gulp.dest('./'));
  cb();
});

gulp.task('minify',
  gulp.series(clean, 'concat', 'compress')
);

gulp.task('default',
  gulp.series('bump', 'remove', 'zip')
);
