const gulp = require('gulp');
const bump = require('gulp-bump');
const zip = require('gulp-zip');
const fs = require('fs');
const path = require('path');
const rimraf = require('gulp-rimraf');
const rename = require('gulp-rename');
const cheerio = require('gulp-cheerio');

const getPackageJson = function () {
  return JSON.parse(fs.readFileSync('./manifest.json', 'utf8'));
};

gulp.task('bump', () => gulp.src('./manifest.json')
  .pipe(bump({ type: 'minor' }))
  .pipe(gulp.dest('./')));

gulp.task('remove', cb => {
  gulp.src('./Chrome Notepad*.zip', { read: false }) // much faster
    .pipe(rimraf());

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

gulp.task('default',
  gulp.series('bump', 'remove', 'zip')
);
