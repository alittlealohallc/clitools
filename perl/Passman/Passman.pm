package Passman;

=head1 NAME

Passman - Perl extension for passman library

=head1 SYNOPSIS

  use Passman;
  my $pass_obj = new Passman(optional_password_file);
  my $pass_app = 'some_application';
  my $svc_user = 'some_service_account';
  my $svc_pass = $pass_obj->getPassword( $pass_app, $svc_user );

=head1 DESCRIPTION

Passman is a core library for storing credentials in an encrypted format
for use in perl scripts. This module handles encryption and deencryption 
of the credentials.

=head2 EXPORT

None by default.

=head1 SEE ALSO

Mention other useful documentation such as the documentation of
related modules or operating system documentation (such as man pages
in UNIX), or any relevant external documentation such as RFCs or
standards.

If you have a mailing list set up for your module, mention it here.

If you have a web site set up for your module, mention it here.

=head1 AUTHOR

Kent Schaeffer
ne0crank@icloud.com

=head1 MAINTENANCE

Kent Schaeffer
ne0crank@icloud.com

=head1 COPYRIGHT AND LICENSE

Copyright (C) 2022 Kent Schaeffer

This library is free software; you can redistribute it and/or modify
it under the same terms as Perl itself, either Perl version 5.34.0 or,
at your option, any later version of Perl 5 you may have available.

=cut

# required modules
use strict;
use warnings;

use IO::All;
use JSON::XS qw( encode_json decode_json );
use MIME::Base64 qw( encode_base64 decode_base64 );
use Crypt::CBC;
use Data::Dump qw( dump );
use Cwd qw( abs_path );
use File::Basename qw( dirname basename );
our $VERSION = '0.05';
our $DEBUG   = 0;

my $passman_file = '/.passman';
my $cryptkey     = 'humptydumptysatonawallagreatfall';
my $cipher       = Crypt::CBC->new(
	-cipher => 'Rijndael',
	-key    => $cryptkey,
	-pbkdf  => 'pbkdf2',
);

sub new {
	my ( $class ) = shift;
	my $self = {
		_passfile => shift || $passman_file,
		_cipher   => '',
		_cryptkey => '',
	};
	dump 'Passman.pm new class', $self if ( $DEBUG );
	return bless $self, $class;
}


sub _readAll {
	my ( $self ) = @_;
	dump $self if ( $DEBUG );
	system( "touch $self->{_passfile}" ) if ( not -e $self->{_passfile} );
	return {} if ( -z $self->{_passfile} );
	return decode_json( io->file( $self->{_passfile} )->all );
}

sub _writeAll {
	my ( $self, $data ) = @_;
	dump $data if ( $DEBUG );
	$self->{_passfile} = $self->{_passfile} || $passman_file;
  return io( $self->{_passfile} )->print( encode_json( $data ) );
}

sub _encrypt {
  my ( $self, $decrypted ) = @_;
	$self->{_cryptkey} = $self->{_cryptkey} || $cryptkey;
  $self->{_cipher} = $cipher || Crypt::CBC->new(
		-cipher => 'Rijndael',
		-key    => $self->{_cryptkey},
		-pbkdf  => 'pbkdf2',
	);
	return encode_base64( $self->{_cipher}->encrypt( $decrypted ) );
}

sub _decrypt {
  my ( $self, $crypted ) = @_
	$self->{_cryptkey} = $self->{_cryptkey} || $cryptkey;
  $self->{_cipher} = $cipher || Crypt::CBC->new(
		-cipher => 'Rijndael',
		-key    => $self->{_cryptkey},
    -pbkdf  => 'pbkdf2',
	);
	return $self->{_cipher}->decrypt( decode_base64( $crypted ) );
}

sub _validate {
	my ( $self, $decrypt, $encrypt ) = @_;
	my $encrypted = $self->_encrypt( $decrypt );
	return $encrypt eq $encrypted;
}

sub _getApplication {
	my ( $self, $appl ) = @_;
	my $all_apps = $self->_readAll;
	dump $all_apps if ( $DEBUG );
	return $all_apps->{ $appl };
}

sub _getUser {
	my ( $self, $appl, $user ) = @_;
	dump 'Passman.pm _getUser', $self, $appl, $user if ( $DEBUG );
	my $valid_app = $self->_getApplication( $appl, $user );
	return $valid_app->{ $user };
}

sub decrypt {
	my ( $self, $s ) = @_;

	my $cipher = Crypt::CBC->new(
		-key         => $cryptkey,
		-cipher      => 'Cipher::AES',
		-iv          => $ivector,
		-literal_key => 1,
		-header      => "none",
		-keysize     => 64
	);
	return $cipher->decrypt( MIME::Base64::decode_base64($s) );
}

sub getPassword {
	my ( $self, $appl, $user ) = @_;
	my $valid_user = $self->_getUser( $appl, $user );
	return $self->_decrypt( $valid_user->{ pass } );
}

sub addPassword {
	my ( $self, $appl, $user, $pass ) = @_;
    my $exist_user = $self->_getUser( $appl, $user );
	dump 'Passman.pm add password1', $appl, $user, $pass, $exist_user, $self if ( $DEBUG );
    return $self->_validate( $pass, $exist_user->{pass} ) if ( $exist_user );
    my $data = $self->_readAll();
	my $encrypt = $self->_encrypt( $pass );
	$data->{ $appl }{ $user }{pass} = $encrypt;
	dump 'Passman.pm add password2', $data, $self if ( $DEBUG );
	$self->_writeAll( $data );
	return 'added';
}

sub modPassword {
  my ( $self, $appl, $user, $old_pass, $new_pass ) = @_;
	my $data = $self->_readAll();
	if ( $data->{ $appl }{ $user } ) {
		if ( $self->_validate( $old_pass, $data->{ $appl }{ $user }{pass} ) ) {
			my $encrypt = $self->_encrypt( $new_pass );
			$data->{ $appl }{ $user }{pass} = $encrypt;
			$self->_writeAll( $data );
			return 'modded';
		} else {
			return 'different';
		}
	} else {
		return 'none';
	}
}

sub delPassword {
  my ( $self, $appl, $user ) = @_;
	my $data = $self->_readAll();
	if ( $data->{ $appl }{ $user } ) {
		delete $data->{ $appl }{ $user};
		delete $data->{ $appl } if ( scalar $data->{ $appl } eq $data->{ $appl} );
		$self->_writeAll( $data );
		return 'deleted';
	} else {
		return 'not found';
	}
}

1;
__END__
