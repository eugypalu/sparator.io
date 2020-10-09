module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        uglify: {
            build: {
                src: 'src/js/app.js',
                dest: 'app/js/app.min.js'
            }
        },

        copy: {
            main: {
                expand: true,
                cwd: 'node_modules/three/build',
                src: '**',
                dest: 'app/js/',
            },
            lib : {
                expand: true,
                cwd: 'src/js/lib',
                src: '**',
                dest: 'app/js/lib',
            },
        }
    });



    // Load the plugin that provides the "uglify" task.
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-copy');
    // Default task(s).
    grunt.registerTask('default', ['uglify','copy']);

};
