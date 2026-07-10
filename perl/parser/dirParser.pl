#!/usr/bin/env perl

=head1 NAME

drParser.pl

=head1 SYNOPSIS

drParser.pl - parses folder structure of given path and returns count of files and folders.

=head1 DESCRIPTION

Parses folder structure of given path and returns count of files and folders.

=head2 EXPORT

outputs count of files and folders to the console

=head1 SEE ALSO

=head1 AUTHOR

Kent schaeffer
kent@kentknowsme.com

=head1 MAINTENANCE

Kent Schaeffer
kent@kentknowsme.com

=head1 COPYRIGHT AND LICENSE

Copyright (C) 2022 by Kent Schaeffer

This library is free software; you can redistribute it and/or modify
it under the same terms as Perl itself, either Perl version 5.34.0 or,
at your option, any later version of Perl 5 you may have available.

=cut

## required modules

use strict;
use warnings;
use Cwd qw( abs_path );
use IO::All qw( is_dir updir All_Dirs All_Files );
use Getopt::Long;
use File::Basename qw( dirname );

Getopt::Long::Configure( "bundling" );

# use Data::Dump qw( dump );

## local variables

our $VERSION = '0.01';

my $opts = {};

GetOptions(
  $opts,
  'path|p'    => \$opts->{path},
  'version|v' => \$opts->{version},
);
$opts->{version} and { print "\nVersion $VERSION\n\n" && exit 0 };

$opts->{path} |= dirname &abs_path($0);
my $dirObj = ( io( $opts->{path} )->is_dir )
  ? io( $opts->{path} )
  : io->updir;

my $allDirs = sprintf $dirObj->All_Dirs;
my $allFiles = sprintf $dirObj->All_Files;
# dump $allDirs, $allFiles;
print "dirParser Output\n================\n";
print "Parsed Folder:\t" . $dirObj . "\n";
print "Folders:\t" . $allDirs . "\nFiles\t\t" . $allFiles . "\n";
