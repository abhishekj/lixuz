# LIXUZ content management system
# Copyright (C) Utrop A/S Portu media & Communications 2008-2011
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

package LIXUZ::Controller::Admin::Newsletter;

use Moose;
use MooseX::NonMoose;
use namespace::autoclean;
BEGIN { extends 'Catalyst::Controller::FormBuilder' };
with 'LIXUZ::Role::List::Database';

use LIXUZ::HelperModules::Lists qw(reply_json_list);
use LIXUZ::HelperModules::JSON qw(json_response json_error);
use LIXUZ::HelperModules::Includes qw(add_jsIncl);
use LIXUZ::HelperModules::Editor qw(add_editor_incl);
use LIXUZ::HelperModules::EMail qw(send_raw_email_to);
use LIXUZ::HelperModules::Search qw(perform_search perform_advanced_search);

sub index : Path Args(0) Form('/core/search')
{
    my ( $self, $c, $query ) = @_;
    my $subscription = $c->model('LIXUZDB::LzNewsletterSubscription');
    my $list = $self->handleListRequest({
            c => $c,
            query => $query,
            object => $subscription,
            objectName => 'subscriptions',
            template => 'adm/newsletter/index.html',
            orderParams => [qw(subscription_id name file status)],
            searchColumns => [qw(email name)],
            advancedSearch =>[ qw(groups.group_id) ],
        });
    if ($c->req->param('_JSON_Submit'))
    {
        return reply_json_list($c,$list,[ 'subscription_id','email','name', 'format','send_every' ]);
    }
    my $i18n = $c->stash->{i18n};
    $c->stash->{template} = 'adm/newsletter/index.html';
    $c->stash->{pageTitle} = $i18n->get('Newsletter subscriptions');
    add_jsIncl($c,'newsletter.js','utils.js');
    add_editor_incl($c);
    $self->init_searchFilters($c);
}

sub delete : Local Param
{
    my ($self,$c,$subid) = @_;

    my $sub = $c->model('LIXUZDB::LzNewsletterSubscription')->find({ subscription_id => $subid });

    if(not $sub or not defined $subid or $subid =~ /\D/)
    {
        return json_error($c);
    }
    $sub->delete();
    return json_response($c);
}

sub send : Local
{
    my ( $self, $c, $query ) = @_;
    my $i18n = $c->stash->{'i18n'};
    my $subscription = $c->model('LIXUZDB::LzNewsletterSubscription')->search();
    $c->stash->{template} = 'adm/newsletter/send.html';
    $c->stash->{pageTitle} = $i18n->get('Manual newsletter');
    add_jsIncl($c,'newsletter.js','utils.js');
    add_editor_incl($c);
}

sub sentPreviously : Local
{
    my ( $self, $c ) = @_;

    my $wants = $c->req->param('wants');

    if ($wants eq 'list')
    {
        my @content;
        my $saved = $c->model('LIXUZDB::LzNewsletterSaved')->search(undef,{ order_by => 'sent_at' });
        while(defined($saved) && (my $s = $saved->next))
        {
            push(@content,{
                    saved_id => $s->saved_id,
                    from => $s->from_address,
                    subject => $s->subject,
                    body => $s->body,
                    format => $s->format,
                    sent_at => $s->sent_at,
                });
        }
        return json_response($c, { content => \@content });
    }
    elsif(length($wants))
    {
        my $newsletter = $c->model('LIXUZDB::LzNewsletterSaved')->find({ saved_id => $wants});
        if(not $newsletter)
        {
            return json_error($c,'NOTFOUND');
        }
        return(json_response($c, {
                    from => $newsletter->from_address,
                    subject => $newsletter->subject,
                    body => $newsletter->body,
                    format => $newsletter->format,
                    sent_at => $newsletter->sent_at,
                    saved_id => $newsletter->saved_id,
                }));
    }
    else
    {
        return json_error($c,'UNKNOWN_REQUEST');
    }
    return json_error($c);
}

sub submitManual : Local
{
    my ( $self, $c ) = @_;

    my $message = $c->req->param('message');
    my $subject = $c->req->param('subject');
    my $type = $c->req->param('type');
    my $from = $c->req->param('from');
    $type = (defined $type && $type eq 'html') ? 'HTML' : 'TEXT';
    # FIXME: e-mail ought to be validated
    $from = (defined $from && $from =~ /.+@.*\./) ? $from : $c->config->{LIXUZ}->{from_email};
    my @recipients = $c->req->param('recipient');
    my %dupeCheck;

    my @sendTo;

    foreach my $email (@recipients)
    {
        next if $dupeCheck{$email};
        if ($email =~ s/^group_(\d+)$/$1/)
        {
            my $groups = $c->model('LIXUZDB::LzNewsletterSubscriptionGroup')->search({ group_id => $email });
            while((defined $groups) && (my $g = $groups->next))
            {
                $g = $g->subscription;
                my $add = $g->email;
                next if $dupeCheck{$add};
                $dupeCheck{$add} = 1;
                push(@sendTo,{ email => $g->email, name => $g->name });
            }
        }
        else
        {
            my $nameFinder = $c->model('LIXUZDB::LzNewsletterSubscription')->search({ email => $email });
            my $name;
            if ($nameFinder && $nameFinder->count > 0)
            {
                $name = $nameFinder->next;
                if ($name && $name->name)
                {
                    $name = $name->name;
                }
                else
                {
                    $name = undef;
                }
            }
            $dupeCheck{$email} = 1;
            push(@sendTo, { email => $email, name => $name });
        }
    }
    foreach my $email (@sendTo)
    {
        my $name = $email->{name};
        my $address = $email->{email};
        if (defined $name)
        {
            $name =~ s/(<|>)//g;
            $address = $name.' <'.$address.'>';
        }
        send_raw_email_to($c,$subject,$message,$address,$from,$type);
    }
    $type = lc($type);
    my $newMessage = $c->model('LIXUZDB::LzNewsletterSaved')->create({
            sent_by_user => $c->user->user_id,
            from_address => $from,
            format => $type,
            subject => $subject,
            body => $message,
        });
    return json_response($c);
}

sub groupList : Local
{
    my ( $self, $c ) = @_;

    my @groupList;
    my $groups = $c->model('LIXUZDB::LzNewsletterGroup')->search(undef,{order_by => 'group_name'});
    while(my $group = $groups->next)
    {
        my $info = {
                group_id => $group->group_id,
                group_name=> $group->group_name,
            };
        if(defined $self->{__groupsEnabled} )
        {
            if($self->{__groupsEnabled}->{$group->group_id})
            {
                $info->{enabled} = 1;
            }
            else
            {
                $info->{enabled} = 0;
            }
        }
        push(@groupList,$info);
    }
    return json_response($c,{ groups => \@groupList });
}

sub groupInfo : Local Param
{
    my ( $self, $c, $group_id ) = @_;
    my $group = $c->model('LIXUZDB::LzNewsletterGroup')->find({ group_id => $group_id });
    if(not $group)
    {
        return(json_error($c,'INVALIDID'));
    }
    my $info = {
        group_name => $group->group_name,
        group_id => $group->group_id,
        internal => $group->internal,
    };
    return json_response($c,$info);
}

sub groupDelete : Local Param
{
    my ( $self, $c, $group_id ) = @_;
    my $group = $c->model('LIXUZDB::LzNewsletterGroup')->find({ group_id => $group_id });
    if(not $group)
    {
        return(json_error($c,'INVALIDID'));
    }
    $group->delete();
    return json_response($c);
}

sub groupSave : Local
{
    my ( $self, $c ) = @_;

    my $group;
    if ($c->req->param('group_id') eq 'new')
    {
        if(not defined $c->req->param('group_name'))
        {
            return json_error($c,'GROUP_NAME_MISSING');
        }
        $group = $c->model('LIXUZDB::LzNewsletterGroup')->create({
                group_name => $c->req->param('group_name'),
                internal => $c->req->param('group_internal') eq 'false' ? 0 : 1,
            });
    }
    else
    {
        $group = $c->model('LIXUZDB::LzNewsletterGroup')->find({ group_id => $c->req->param('group_id') });
        if(not $group)
        {
            return json_error($c,'INVALID_GROUP_ID');
        }
        if(defined $c->req->param('group_name'))
        {
            $group->set_column('group_name',$c->req->param('group_name'));
        }
        if(defined $c->req->param('group_internal'))
        {
            $group->set_column('internal',
                $c->req->param('group_internal') eq 'false' ? 0 : 1);
        }
    }
    $group->update();
    return json_response($c);
}

sub subscriptionGroupEdit : Local Param
{
    my ( $self, $c, $subid ) = @_;

    my $sub = $c->model('LIXUZDB::LzNewsletterSubscription')->find({ subscription_id => $subid });

    if(not $sub or not defined $subid or $subid =~ /\D/)
    {
        return json_error($c);
    }

    my $groups = $sub->groups;
    if (defined $c->req->param('groups'))
    {
        while((defined $groups) && (my $group = $groups->next))
        {
            $group->delete();
        }
        foreach my $gid (split(/,/, $c->req->param('groups')))
        {
            $c->model('LIXUZDB::LzNewsletterSubscriptionGroup')->create({ subscription_id => $subid, group_id => $gid});
        }
        return json_response($c);
    }
    else
    {
        my %groupsEnabled;
        while((defined $groups) && (my $group = $groups->next))
        {
            $groupsEnabled{$group->group_id} = 1;
        }
        $self->{__groupsEnabled} = \%groupsEnabled;
        return $self->groupList($c);
    }
}

sub init_searchFilters : Private
{
    my ( $self, $c ) = @_;

    my $i18n = $c->stash->{i18n};
    my $groupOptions = [];
    my $groups = $c->model('LIXUZDB::LzNewsletterGroup')->search(undef,{order_by => 'group_name'});
    while(my $group = $groups->next)
    {
        push(@{$groupOptions}, {
                value => $group->group_id,
                label => $group->group_name,
            });
    }
    $c->stash->{searchFilters} = [
        {
            name => $i18n->get('Group'),
            realname => 'group_id',
            options => $groupOptions,
            selected => defined $c->req->param('filter_group_id') ? $c->req->param('filter_group_id') : undef,
        },
    ];
}

1;
