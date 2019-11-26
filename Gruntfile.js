'use strict';

module.exports = function(grunt) {

  // Load grunt tasks automatically
  require('load-grunt-tasks')(grunt);

  // Time how long tasks take. Can help when optimizing build times
  require('time-grunt')(grunt);

  // Project configuration.
  grunt.initConfig({
    // Metadata.
    pkg: grunt.file.readJSON('package.json'),
    banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
      '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
      '<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
      '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
      ' Licensed <%= pkg.license %> */\n',
    // Task configuration.
    clean: {
      files: ['dist']
    },
    frame: {
      options: {
        frame: 'src/frame.js',
      },
      dist: {
        src: ['src/xhr.js',
              'src/api.js'],
        dest: 'dist/<%= pkg.name %>.js'
      },
    },
    copy: {
      docs: {
        src: 'dist/<%= pkg.name %>.js',
        dest: 'docs/<%= pkg.name %>.js'
      }
    },
    uglify: {
      options: {
        banner: '<%= banner %>',
        report: 'gzip'
      },
      dist: {
        src: ['dist/<%= pkg.name %>.js'],
        dest: 'dist/<%= pkg.name %>.min.js'
      },
    },
    compress: {
      options: {
        mode: 'gzip'
      },
      dist: {
        src: ['dist/<%= pkg.name %>.min.js'],
        dest: 'dist/<%= pkg.name %>.min.js'
      },
    },
    connect: {
      test: {
        options: {
          base: '.',
          port: 9000
        }
      }
    },
    qunit: {
      options: {
        timeout: 5000,
        httpBase: 'http://localhost:9000'
      },
      src: ['test/*.html']
    },
    jshint: {
      gruntfile: {
        options: {
          jshintrc: '.jshintrc'
        },
        src: 'Gruntfile.js'
      },
      src: {
        options: {
          jshintrc: 'src/.jshintrc'
        },
        src: ['src/**/*.js',
              '!src/*frame.js']
      },
      dist: {
        options: {
          jshintrc: 'src/.jshintrc-dist'
        },
        src: ['dist/*.js']
      },
      test: {
        options: {
          jshintrc: 'test/.jshintrc'
        },
        src: ['test/**/*.js']
      },
    },
    nugetpack: {
        dist: {
            src: '<%= pkg.name %>.nuspec',
            dest: 'dist/',
            options: {
              version: '<%= pkg.version %>'
            }
        }
    },
    nugetpush: {
        dist: {
            src: 'dist/<%= pkg.name %>.<%= pkg.version %>.nupkg'
        }
    }
  });

  grunt.loadTasks('tasks');

  // Default task.
  grunt.registerTask('default', ['clean', 'frame', 'jshint', 'uglify', 'compress', 'connect', 'qunit', 'copy']);
  grunt.registerTask('test', ['clean', 'frame', 'jshint', 'uglify', 'connect', 'qunit']);
  grunt.registerTask('nuget', ['nugetpack', 'nugetpush']);

};
