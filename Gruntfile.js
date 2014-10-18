var request = require('request');
var cheerio = require('cheerio');
var pick = require('object.pick');
var fs = require('fs');
var html = require('html');
var uncss = require('uncss');
var glob = require("glob");

module.exports = function(grunt) {

  var getHtml = function(slug) {
    if(!fs.existsSync('output')) {
      fs.mkdirSync('output');
    }
    var done = this.async();
    request('http://en.wikipedia.org/wiki/' + slug, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        var $ = cheerio.load(body),
            text;

        $('*').each(function() {
          this.attribs = pick(this.attribs,
            ['class', 'src', 'id', 'style', 'colspan', 'cellspacing']);
        });

        $('script, link, style, meta').remove();
        $('head').append('<link rel="stylesheet" href="' + slug + '.css">');

        text = $.html().replace(/<!--[\s\S]*?-->/g, '');
        text = html.prettyPrint(text, {indent_size: 2});

        fs.writeFile('output/' + slug + '.html', text, function(err) {
          if(err) {
            grunt.log.error(err);
            done(false);
          } else {
            grunt.log.writeln('Downloaded ' + slug + '.html');
            done();
          }
        });
      }
    });
  };

  var getCss = function(slug) {
    if(!fs.existsSync('tmp')) {
      fs.mkdirSync('tmp');
    }
    var done = this.async();
    request('http://en.wikipedia.org/wiki/' + slug, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        var $ = cheerio.load(body);
        var stylesheetCount = $('link[rel="stylesheet"]').length;
        var completed = 0;
        $('link[rel="stylesheet"]').each(function(i) {
          var href = $(this).attr("href");
          request('http:' + href, function (error, response, body) {
            fs.writeFile("tmp/" + slug + i + ".css", body, function(err) {
              if(err) {
                grunt.log.error(err);
                done(false);
              } else {
                grunt.log.writeln('Downloaded ' + slug + i + '.css');
                completed++;
                if (completed == stylesheetCount) {
                  done();
                }
              }
            });
          });
        });
      }
    });
  };

  var cleanCss = function(slug) {
    var done = this.async();
    var stylesheets = glob.sync('tmp/' + slug + '*.css').map(function(filename) {
      return filename.split("/")[1];
    });

    var files = ['output/' + slug + '.html'],
        options = {
          csspath: '../tmp/',
          stylesheets: stylesheets,
        };

    uncss(files, options, function (error, output) {
      if (!error) {
        fs.writeFile('output/' + slug + '.css', output, function(err) {
          if(err) {
            grunt.log.error(err);
            done(false);
          } else {
            grunt.log.writeln('Created ' + slug + '.css');
            done();
          }
        });
      }
    });
  };

  var slug = grunt.option('slug');
  if (!slug) {
    grunt.log.error("--slug is required.");
    return;
  }
  grunt.registerTask('getHtml', 'Download a Wikipedia HTML file and simplify it.', getHtml);
  grunt.registerTask('getCss', 'Download CSS files contained in a Wikipedia HTML file.', getCss);
  grunt.registerTask('cleanCss', 'Download CSS files contained in a Wikipedia HTML file.', cleanCss);
  grunt.registerTask('default', ['getHtml:' + slug, 'getCss:' + slug, 'cleanCss:' + slug, 'connect:server:keepalive']);

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    connect: {
      server: {
        options: {
          base: 'output'
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-connect');
};
