//npm install less-plugin-autoprefix gulp-rev gulp-rev-replace less-plugin-clean-css gulp-util gulp-less gulp-sourcemaps gulp-jshint gulp-concat gulp-uglify gulp-imagemin gulp-notify gulp-rename gulp-cache del --save-dev
var setting = {
    isProduction : true,
    sourceMap : false,
    pathPrefix : '../',
    viewSubfix : '.html'
}

var path = {
    src : {
        base : 'app',
        view : 'app/view',
        css  : 'app/css/style.less',
        img  : 'app/image/*.*',
        js   : 'app/js/*.js'
    },
    dist : {
        base : './',
        view : './view',
        css  : './css',
        img  : './image',
        js   : './js'
    },
    ext : {
        base : './node_modules',
        jquery : './node_modules/jquery/dist/jquery.min.js',
        bootstrap : './app/css/bootstrap.less'
    }
}

var fs = require('fs'),
    del = require('del'),
    gulp = require('gulp'),
    less = require('gulp-less'),
    gutil = require('gulp-util'),
    cache = require('gulp-cache'),
    jshint = require('gulp-jshint'),
    uglify = require('gulp-uglify'),
    rename = require('gulp-rename'),
    concat = require('gulp-concat'),
    notify = require('gulp-notify'),
    reversion = require('gulp-rev'),
    sass = require('gulp-ruby-sass'),
    cssnano = require('gulp-cssnano'),
    imagemin = require('gulp-imagemin'),
    sourcemaps = require('gulp-sourcemaps'),
    revReplace = require('gulp-rev-replace'),
    revCollector = require('gulp-rev-collector'),
    lessMinifier = require('less-plugin-clean-css'),
    minifyCss = new lessMinifier({advanced : true}),
    autoprefixer = require('less-plugin-autoprefix'),
    autoprefix = new autoprefixer({browsers: ["last 10 versions"]});

if(gutil.env.dev === true) {
    setting.sourceMap = true;
    setting.isProduction = false;
    gutil.log('running on DEV mode');
}else{
    gutil.log('running on release mode');
}

// Styles
gulp.task('styles', function () {
    var lessPlugins = new Array();
    lessPlugins.push(autoprefix) ;
    if(setting.isProduction){
        lessPlugins.push(minifyCss);
    }
    return gulp.src(path.src.css)
        .pipe(setting.isProduction ? gutil.noop() : sourcemaps.init())
        .pipe(less({plugins: lessPlugins}))
        .pipe(setting.isProduction ? gutil.noop() : sourcemaps.write())
        .pipe(rename({ suffix: '.min' }))
        .pipe(gulp.dest(path.dist.css))
        .pipe(notify('Less style compiled'));
});

gulp.task('bootstrap', function () {
    var lessPlugins = new Array();
    lessPlugins.push(autoprefix) ;
    if(setting.isProduction){
        lessPlugins.push(minifyCss);
    }
    return gulp.src(path.ext.bootstrap)
        .pipe(setting.isProduction ? gutil.noop() : sourcemaps.init())
        .pipe(less({plugins: lessPlugins}))
        .pipe(setting.isProduction ? gutil.noop() : sourcemaps.write())
        .pipe(rename({ suffix: '.min' }))
        .pipe(gulp.dest(path.dist.css))
        .pipe(notify('Less bootstrap compiled'));
});
// Scripts
gulp.task('scripts', function() {
  return gulp.src(path.src.js)
    .pipe(jshint({
        'strict': true,
        'undef': true,
        'unused': true,
        'browser': true,
        'devel': false,
        'globals' : ['jQuery']
    }))
    .pipe(setting.isProduction ? gutil.noop() : sourcemaps.init())
    .pipe(jshint.reporter('default'))
    .pipe(concat(path.dist.js + '/script.js'))
    .pipe(setting.isProduction ? gutil.noop() : sourcemaps.write())
    .pipe(gulp.dest('.'))
    .pipe(rename({ suffix: '.min' }))
    .pipe(!setting.isProduction ? gutil.noop() : uglify())
    .pipe(gulp.dest('.'))
    .pipe(notify({ message: 'Scripts tasks completed' }));
});

// Images
gulp.task('images', function() {
  return gulp.src(path.src.img)
    .pipe(cache(imagemin({ optimizationLevel: 3, progressive: true, interlaced: true })))
    .pipe(gulp.dest(path.dist.img))
    .pipe(notify({ message: 'Images task complete' }));
});

// Clean
gulp.task('clean', function() {
  return del([path.dist.js,path.dist.img,path.dist.css,path.dist.view,path.dist.base + 'rev-manifest.json']);
});
//Copy Html View Files
gulp.task('copyHtml', function(){
    return gulp.src([path.src.view + '/*', path.src.view + '/*/**/*'])
    .pipe(gulp.dest(path.dist.view));
});
//Copy js libraries Files
gulp.task('copyJsLib', function(){
    return gulp.src([path.ext.jquery])
    .pipe(gulp.dest(path.dist.js));
});
// Versioning 
gulp.task('reversion', function () {
    // by default, gulp would pick `assets/css` as the base, 
    // so we need to set it explicitly: 
    return gulp.src([path.dist.css + '/*.min.css', path.dist.js + '/*.min.js', path.dist.img + '/*.*'], {base: './'})
        .pipe(reversion())
        .pipe(gulp.dest(path.dist.base))  // write rev'd assets to build dir 
        .pipe(reversion.manifest({base: './'}))
        .pipe(gulp.dest(path.dist.base)); // write manifest to build dir 
});

gulp.task('replace', ['copyHtml', 'reversion'], function(){
    var manifestPath = path.dist.base + 'rev-manifest.json';
    var manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for(k in manifest){
        manifest[k] = setting.pathPrefix + manifest[k];
    }
    fs.writeFile(manifestPath, JSON.stringify(manifest, null, "\t"), (err) => {
      if (err) throw err;
    });
    return gulp.src([manifestPath, path.dist.view + '/*/**/*'+setting.viewSubfix])
    .pipe(revCollector({
        revReplace: true
    }))
    .pipe(gulp.dest(path.dist.view));
});

// Default task
gulp.task('default', ['clean','styles', 'bootstrap', 'scripts', 'images'], function() {
    if(setting.isProduction){
        gulp.start('replace');
    }else
        gulp.start('watch');
});

// Watch
gulp.task('watch', function() {
    try{
        if (!fs.existsSync(path.dist.js + '/lib.js')) {
            gutil.log('js lib not exist, trying to copy Html it to distination');
            gulp.start('copyJsLib');
        }
        fs.access(path.dist.view + 'index.html', fs.F_OK, function(exists){
            if(exists){
                gulp.start('copyHtml');
            }else{
                gutil.log('view already exists');
            }
        });
    }catch(err){
        gutil.log('error occur: ' + err);
    }
    gulp.watch(path.src.base + '/view/**/*.html', ['copyHtml']);
    // Watch .scss files
    gulp.watch(path.src.base + '/css/**/*.less', ['styles']);

    // Watch .js files
    gulp.watch(path.src.js, ['scripts']);

    // Watch image files
    gulp.watch(path.src.img, ['images']);
});