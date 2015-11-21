// Include gulp
var gulp = require('gulp');
// Define base folders

var dest = 'build/';
// Include plugins
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var minifyCSS = require('gulp-minify-css');
var concatCss = require('gulp-concat-css');

// Concatenate & Minify JS
gulp.task('scripts', function() {
    return gulp.src([
        "js/knockout-3.3.0.js",
        "js/ko.observableDictionary.js",
        "js/jquery-1.11.2.min.js",
        "js/jquery.qtip.min.js",
        "js/bignumber.min.js",
        "js/moment.js",
        "js/easystar-0.2.1.min.js",
        "js/PathFinderPlugin.js",
        "js/jquery-ui.min.js",
        "inc_tower.js",
        "js/Tower.class.js",
        "js/Enemy.class.js"
    ]).pipe(concat('incTower.js'))
      .pipe(rename({suffix: '.min'}))
      .pipe(uglify())
      .pipe(gulp.dest(dest + 'js'));
});
gulp.task('css', function() {
    return gulp.src([
        'css/incTower.css',
        'css/jquery.qtip.css',
        'css/jquery-ui.min.css'
    ]).pipe(concatCss('incTower.css'))
      .pipe(rename({suffix: '.min'}))
      .pipe(minifyCSS())
      .pipe(gulp.dest(dest + 'css'));
});
gulp.task('copy-css-images', function () {
    return gulp.src([
        'css/images/*'
    ]).pipe(gulp.dest('build/css/images/'));
});
// Watch for changes in files
gulp.task('watch', function() {
    // Watch .js files
    gulp.watch('js/*.js', ['scripts']);
    gulp.watch('css/*.css', ['css']);
});
// Default Task
gulp.task('default', ['scripts', 'copy-css-images', 'css', 'watch']);