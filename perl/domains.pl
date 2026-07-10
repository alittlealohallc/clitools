#!/usr/bin/env perl

use strict;
use warnings;
use Data::Dump qw( dump );
use Net::DNS::Dig qw(
    :forceEmu
    ndd_gethostbyaddr
    ndd_gethostbyname
    ndd_gethostbyname2
    AF_INET
    AF_INET6
);

my $resultFile = "~/git/clitools/perl/businesszones.txt";
unlink $resultFile;
# my $tlds = ['com'];
my $tlds = ['com','net','org','me','name','homes','casa','agency','dev','website', 'io','app','co','us','biz','info','xyz','online','site','store','tech','space','cloud', 'pro'];
my $domains = [
    'trxn llc'
];

open my $resultFileHandle, "+>>encoding(utf8)", $resultFile;
my $digA = new Net::DNS::Dig;
foreach my $spaced ( @{ $domains } ) {
    $spaced =~ m/^$/ and next;
    my $dname = $spaced;
    $dname =~ s/\s+//g;
    my $titled = join ' ', map({ ucfirst() } split /\s+/, $spaced);

    if ( $spaced !~ m/llc$/ig ) {
        my $llcDname = $dname . 'llc';
        my $llcTitled = $titled . ' llc';
        foreach my $tld ( @{ $tlds } ) {
            my $llcHost = $llcDname . '.' . $tld;
            my $dObj = $digA->for($llcHost, "A");
            # my $digStatus = `/usr/bin/dig $llcHost | grep -i status | cut -d':' -f3 | cut -d',' -f1`;
            # my $soaStatus = ( $digStatus =~ m/NXDOMAIN/ ) ? 'Available' : 'Taken';
            my $digStatus = ( $dObj->{HEADER}->{RCODE} == 3 ) ? 'Available' : 'Taken';
            # print "$titled $hostname\n";
            print $resultFileHandle "$llcTitled: $llcHost: $digStatus\n";
        }
    }
    foreach my $tld ( @{ $tlds } ) {
        my $hostname = $dname . '.' . $tld;
        my $dObj = $digA->for($hostname, "A");
        # my $tObj = $digA->to_text();
        # dump $dObj, $tObj;
        # print $dObj->{HEADER}->{RCODE} . "\n";

        my $digStatus = ( $dObj->{HEADER}->{RCODE} == 3 ) ? 'Available' : 'Taken';
        # print "$titled $hostname\n";
        print $resultFileHandle "$titled: $hostname: $digStatus\n";
    }
}
close $resultFileHandle;
