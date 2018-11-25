// Include gulp
var gulp = require('gulp');
// Define base folders

var dest = 'build/';
// Include plugins
// var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var minifyCSS = require('gulp-minify-css');
var concatCss = require('gulp-concat-css');
var sourcemaps = require('gulp-sourcemaps');
var babel = require('gulp-babel');
var plumber = require('gulp-plumber');
var rjs = require('gulp-requirejs');

var shims = {
    'lib/phaser': {
        deps: [],
        exports: 'Phaser'
    },
    'lib/lodash': {
        deps: [],
        exports: '_'
    },
    'lib/knockout': {
        deps: [],
        exports: 'ko'
    },
    'lib/jquery': {
        deps: [],
        exports: 'jQuery'
    },
    'lib/bignumber': {
        deps: [],
        //exports: 'BigNumber'
    },
    'lib/moment': {
        deps: [],
        exports: 'moment'
    },

    'lib/jquery-ui': {
        deps: ['lib/jquery']
    },
    'lib/jstree': {
        deps: ['lib/jquery']
    }
};


// Concatenate & Minify JS
gulp.task('scripts', function() {
    return gulp.src(
        "js/lib/*.js"
    ).pipe(plumber())
        .pipe(sourcemaps.init())
        // .pipe(concat('incTower.js'))
      // .pipe(rename({suffix: '.min'}))
        .pipe(babel({"compact": false}))
      .pipe(uglify())
        .pipe(sourcemaps.write('maps'))
      .pipe(gulp.dest(dest + 'js/'));
});
gulp.task('rjs', function () {
   return rjs({
       name: "loader",
     baseUrl: 'js',
     out: 'main.js',
       shim: shims,
       optimize: 'uglify',
       generateSourceMaps: true
   }).pipe(plumber())
       .pipe(sourcemaps.init({loadMaps: true}))
       .pipe(sourcemaps.write('maps'))
       .pipe(gulp.dest(dest + 'js/'));
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