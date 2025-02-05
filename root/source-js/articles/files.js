/*
 * LIXUZ content management system
 * Copyright (C) Utrop A/S Portu media & Communications 2008-2011
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
/*
 * Image handling code for Lixuz. Interacts with the RTE, allowing
 * the user to add and edit images
 */

var articleFiles = {
    filesList: null,
    showSelector: function() {},

    imageSpots: [],

    getSpotNameFor: function(spot,extra)
    {
        var spotO = articleFiles.getSpotById(spot);
        if(spotO)
        {
            if(spotO.name)
                return spotO.name;
            if(spotO.as)
                return spotO.as;
        }
        if(extra.spot_name)
            return entry.spot_name;
        return 'Spot '+spot;
    },

    initBuild: function ()
    {
        if(articleFiles.filesList == null)
        {
            try
            {
                articleFiles.filesList = FILES_BOOTSTRAP.entries;
                FILES_BOOTSTRAP = null;
            } catch(e) {}
        }
    },

    buildFileList: function ()
    {
        var html = '';
        $.each(articleFiles.filesList, function (i, entry)
        {
            var obj = entry;
            entry = '<table><tr><td>'+articleFiles.getIconItem(entry);
            entry = entry + '</td><td><a href="#" class="removeFile">'+i18n.get('Remove')+'</a><br /><a target="_blank" href="/files/get/'+obj.file.identifier+'/'+obj.file.file_name+'" class="downloadFile">'+i18n.get('Download')+'</a></td></table>';
            html = html + '<div class="fileEntry" style="width:200px;">'+entry+'</div>';
        });
        $('#article_file_list').html(html+'<div style="clear:both";></div>');

        $('.removeFile').click(function ()
        {
            try
            {
                var id = $(this).parent().parent().html().replace(/.*File\s*ID/,'').replace(/^\D+/,'').replace(/\D.*/g,'');
                var existing = articleFiles.getFileByID(id,true);
                var spot = articleFiles.filesList[existing].spot_no;
                articleFiles.filesList.splice(existing,1);
                articleFiles.buildFileList();
            } catch(e) { lzError(e); }
            return false;
        });

        articleFiles.updateRelCount();
    },

    getIconItem: function (entry)
    {
        var file = entry.file;
        var html = '<div>';
        var hadA = false;
        if(file.icon == null)
        {
            file.icon = '/static/images/icons/mimetypes/unknown.png';
        }
        if(file.is_image)
        {
            hadA = true;
            html = html+'<a href="#" onclick="LZ_AddImageToArticle('+file.file_id+'); return false;">';
            html = html+'<img src="/files/get/'+file.identifier+'?width=80" alt="" />';
        }
        else if(file.is_video)
        {
            hadA = true;
            html = html + '<a href="#" onclick="LZ_AddVideoToArticle('+file.file_id+'); return false;"><img src="/static/images/icons/video.png" alt="" />';
        }
        else if(file.is_audio)
        {
            hadA = true;
            html = html + '<a href="#" onclick="LZ_AddAudioToArticle('+file.file_id+'); return false;"><img src="/static/images/icons/audio.png" alt="" />';
        }
        else
        {
            hadA = true;
            html = html+'<a href="#" onclick="LZ_AddFileToArticle('+file.file_id+'); return false"><img src="'+file.icon+'" alt="" />';
        }
        html = html+'<br />';
        html = html +'<b>'+articleFiles.shortSTR(file.file_name)+'</b><br />';
        html = html+'File ID'+file.file_id+'<br />';
        html = html+'Spot: ';
        if(entry.spot_no)
        {
            html = html+articleFiles.getSpotNameFor(entry.spot_no,entry);
        }
        else
        {
            html = html+'(none)';
        }
        if(hadA)
            html = html+'</a>';
        html = html+'</div>';
        return html;
    },

    shortSTR: function(str, maxLen)
    {
        maxLen = maxLen || 15;
        if(str == null)
            throw('shortSTR: got null str');
        if(str.length > maxLen)
        {
            // FIXME: This is rather ugly, fix it by encoding "" in a raw
            // abbr title instead
            var d = $('<div />');
            var abbr = $('<abbr />');
            abbr.attr('title',str);
            abbr.appendTo(d);
            str = str.substr(0,15)+' ...';
            abbr.html(str);
            str = d.html();
            d.remove();
        }
        return str;
    },

    getFileByID: function(fileid, wantsId)
    {
        var file;
        var id;
        $.each(articleFiles.filesList, function (i, ent)
        {
            if(ent.file_id == fileid)
            {
                file = ent;
                id = i;
            }
        });
        if(wantsId)
            return id;
        return file;
    },

    getIdentifierByID: function(fileid)
    {
        var file = this.getFileByID(fileid);
        if(file == null)
        {
            throw('Unknown file id: '+fileid);
        }
        return file.file.identifier;
    },

    getSpotById: function(spot)
    {
        var ret = null;
        $.each(articleFiles.imageSpots, function (i,ent)
        {
            if(ent.id == spot)
            {
                ret = ent;
            }
        });
        return ret;
    },

    spotTaken: function(spot)
    {
        if(articleFiles.getFileBySpot(spot) == null)
            return false;
        return true;
    },

    getFileBySpot: function(spot)
    {
        var file = null;
        if ($.isPlainObject(spot))
        {
            if(spot.spot_no)
                spot = spot.spot_no;
            else
                spot = spot.id;
        }
        $.each(articleFiles.filesList, function (i, ent)
        {
            if(ent.spot_no == spot)
                file = ent;
        });
        return file;
    },

    autoAssignToSpot: function(entry)
    {
        var spot;
        $.each(articleFiles.imageSpots, function (i,ent)
        {
            if(spot)
                return;
            if(articleFiles.spotTaken(ent))
                return;
            spot = ent.id;
        });
        return spot;
    },

    getFileFromVar: function (getFrom)
    {
        if($.isPlainObject(getFrom))
            return getFrom;
        return articleFiles.getFileByID(getFrom);
    },

    getFileCaption: function (file)
    {
        file = articleFiles.getFileFromVar(file);
        if(file.caption)
            return file.caption;
        return file.file.caption;
    },

    assignToSpot: function (fileEntry, spot)
    {
        if (!spot)
            spot = articleFiles.autoAssignToSpot(fileEntry);
        fileEntry = articleFiles.getFileFromVar(fileEntry);
        if (articleFiles.spotTaken(spot))
        {
            $.each(articleFiles.filesList, function(i,ent)
            {
                if(ent.spot_no == spot)
                    ent.spot_no = null;
            });
        }
        fileEntry.spot_no = spot;
        return fileEntry;
    },

    performFileAddition: function(data,files)
    {
        destroyPI();
        if(data !== null)
            articleFiles.imageSpots = data['/admin/services/templateInfo'].spots;
        $.each(files, function(i, ent)
        {
            if (ent == null || ! $.isPlainObject(ent) || $.isEmptyObject(ent))
                return;
            var file = { file: ent, file_id: ent.file_id };

            var existing = articleFiles.getFileByID(file.file.file_id,true);

            if(file.file.is_image)
                articleFiles.assignToSpot(file);

            if(existing)
            {
                articleFiles.filesList[existing] = file;
            }
            else
            {
                articleFiles.filesList.push(file);
            }
        });

        articleFiles.buildFileList();
    },

    addTheseFiles: function (files)
    {
        LZ_RetrieveSpots('image',function (data)
        {
            articleFiles.performFileAddition(data,files);
        });
    },

    /*
     * Update the file count, as displayed on the page
     */
    updateRelCount: function ()
    {
        $('#filesInArticle').text($('.fileEntry').length);
    }
};

$(articleFiles.initBuild);

function LZ_AddImageToRTE(imageId, RTE)
{
    deprecated();
    var editor = editors[RTE];
    if (!editor)
    {
        lzError('Editor "'+RTE+'" was not found');
        return;
    }
    try
    {
        var d = new Date();
        var identifier = articleFiles.getIdentifierByID(imageId);
        var image = '<img align="right" alt="" title="" src="/files/get/'+identifier+'?width=210" imgId="'+identifier+'" id="image_'+RTE+identifier+d.getTime()+'" /> ';
        editor.execCommand('inserthtml',image);
    }
    catch(e)
    {
        lzException(e);
    }
}

// TODO: At some point we probably want to autorefresh data about the file
function LZ_VideoFLVMissing (videoId,running)
{
    deprecated();
    if(running == 1)
    {
        userMessage(i18n.get_advanced('The video file with file_id %(FILEID) has not been converted to the FLV format used to serve video through Lixuz yet, the process is still running, please reload and try again in a few minutes.\n\nIf the conversion takes more than an hour, please contact your system administrator', { 'FILEID': videoId }));
    }
    else
    {
        userMessage(i18n.get_advanced('The conversion of this file (%(FILEID)) to the FLV format failed. Please contact your system administrator.', { 'FILEID':videoId}));
    }
}

function LZ_AddAudioToArticle (audioId)
{
    deprecated();
    LZ_AddAudioToRTE(audioId,'inline_body');
}

function LZ_AddAudioToRTE(audioId, RTE)
{
    deprecated();
    var editor = editors[RTE];
    if (!editor)
    {
        lzError('Editor "'+RTE+'" was not found');
        return;
    }
    try
    {
        var d = new Date();
        var audio = '<div name="lixuz_audio" uid="'+audioId+'" style="display:block;width:400px;height:50" id="player_'+RTE+audioId+d.getTime()+'"><img src="/static/images/icons/audio.png" alt="" /></div>';
        editor.execCommand('inserthtml',audio);
    }
    catch(e)
    {
        lzException(e);
    }
}

function LZ_AddVideoToArticle (videoId)
{
    deprecated();
    LZ_AddVideoToRTE(videoId,'inline_body');
}

function LZ_AddVideoToRTE(videoId, RTE)
{
    deprecated();
    var editor = editors[RTE];
    if (!editor)
    {
        lzError('Editor "'+RTE+'" was not found');
        return;
    }
    try
    {
        var d = new Date();
        var identifier = articleFiles.getIdentifierByID(videoId);
        var video = '<div name="lixuz_video" uid="'+identifier+'" style="display:block;width:400px;height:300px" id="player_'+RTE+identifier+d.getTime()+'"><img src="/files/get/'+identifier+'?flvpreview=1" style="border:0;" /></div>';
        editor.execCommand('inserthtml',video);
    }
    catch(e)
    {
        lzException(e);
    }
}

function LZ_AddFileToArticle (fileId)
{
    deprecated();
    LZ_AddFileToRTE(fileId,'inline_body');
}

function LZ_AddFileToRTE(fileId, RTE)
{
    deprecated();
    var editor = editors[RTE];
    if (!editor)
    {
        lzError('Editor "'+RTE+'" was not found');
        return;
    }
    try
    {
        var d = new Date();
        var file = articleFiles.getFileByID(fileId).file;
        var title = file.title;
        var fileName = file.file_name.replace(/"/g,'').replace(/\s/g,'_');;
        if(title == null || title.length == 0)
        {
            title = file.file_name;
            if(title == null || title.length == 0)
            {
                title = 'file_id '+fileId;
                fileName = fileId;
            }
        }
        title = title.replace(/<imageId/g,'&gt;').replace(/>/g,'&lt;');
        var identifier = articleFiles.getIdentifierByID(fileId);
        var entry = '<a href="/files/get/'+identifier+'/'+fileName+'">'+title+'</a>';
        editor.execCommand('inserthtml',entry);
    }
    catch(e)
    {
        lzException(e);
    }
}

// New
var templateSpots,
    currFileUID,
    currFileType,

    spotList;

function LZ_AddImageToArticle (imageId)
{
    deprecated();
    currFileType = 'image';
    currFileUID = imageId;
    LZ_RetrieveSpots('image');
}

function LZ_AddFlashToArticle (flashId)
{
    deprecated();
    currFileType = 'flash';
    currFileUID = flashId;
    LZ_RetrieveSpots('flash');
}

function LZ_ArtAddVideo (videoId)
{
    deprecated();
    stub();
}

function LZ_ArtFilePrompt (fileId, fileType,spots,taken)
{
    deprecated();
    var filesAssigned = {};
    $.each(taken, function (key,value) {
            filesAssigned[value] = key;
        });

    spotList = spots;
    
    var includeAdvanced = true;
    if(currFileType == 'flash')
    {
        includeAdvanced = false;
    }

    var title;
    if(filesAssigned[fileId] != null)
    {
        title = i18n.get('Reassign file');
    }
    else
    {
        title = i18n.get('Assign file');
    }
    var html =  '';
    if(filesAssigned[fileId] != null)
    {
        // TODO: Which spot?
        html = html + '<b>'+i18n.get('Note: This file is already assigned to a spot. Reassigning it to another will remove it from its current spot and move it to the new one.')+'</b><br /><br />';
    }
    var leadSel = false;
    if(spots.length == 0)
    {
        html = html+'&nbsp;<i>'+i18n.get('(can not assign to spots - this template has none)')+'</i><br />';
        leadSel = true;
    }
    else
    {
        html = html + htmlCheckbox('fileActionAssignSpot',i18n.get('Assign to spot: '),'assignSpot','radio',true,'fileAction');
        html = html +'<select id="spotSelector">';
        var selected = false;
        var file = articleFiles.getFileByID(fileId);
        spots.unshift({id: 'null',name: i18n.get('(none)')});
        for(var i = 0; i < spots.length; i++)
        {
            var spot = spots[i];
            if ( file.spot_no == spot.id)
            {
                selected = true;
                html = html + '<option SELECTED="SELECTED"';
            }
            else
            {
                html = html + '<option';
            }
            html = html + ' value="'+spot.id+'">'+spot.name;
            if ( file.spot_no == spot.id)
            {
                html = html+' ('+i18n.get('current spot')+')';
            }
            html = html + '</option>';
        }
        html = html + '</select><br />';
        var currentCaption = articleFiles.getFileCaption(fileId);
        if(currentCaption == null)
        {
            currentCaption = '';
        }
        if(currFileType != 'flash')
        {
            html = html + htmlCheckbox('fileActionChangeCaption',i18n.get('Change the caption to:'),'setCaption','radio',false,'fileAction')+'<br />';
            html = html + '<textarea onfocus="$(\'#fileActionChangeCaption\').attr(\'checked\',\'true\');" id="fileSetCaptionEntry" rows="5" style="width:96%">'+currentCaption+'</textarea><br />';
        }

        if(includeAdvanced)
        {
            html = html + '<a href="#" onclick="$(\'#advancedSection\').css({visibility: \'visible\', display:\'block\'}); $(this).css({display: \'none\', visibility: \'hidden\'});return false;">'+i18n.get('Show advanced options')+'</a>';
            html = html + '<div id="advancedSection" style="visibility:hidden; display:none;">';
        }
    }

    if(includeAdvanced)
    {
        if (fileType != 'video')
        {
            html = html + '<br /><br />';
            html = html + i18n.get('Above you may choose to assign this file to a spot, these options allow you to add it directly to the body or lead of an article. Adding it to the body or lead is discouraged unless there are no suitable spots available (as the spots will properly scale and appear in lists properly, images in bodies will in most cases not).');
            html = html + '<br /><br />';
            html = html + htmlCheckbox('fileActionAddToLead',i18n.get('Add to the lead'),'addToLead','radio',leadSel,'fileAction')+'<br />';
            html = html + htmlCheckbox('fileActionAddToBody',i18n.get('Add to the body'),'addToBody','radio',false,'fileAction')+'<br />';
        }
        else
        {
            html = html + htmlCheckbox('fileActionAddToBody',i18n.get('Add to the body'),'addToBody','radio',leadSel,'fileAction')+'<br />';
        }
        html = html + '</div>';
    }
    if(spots.length == 0)
    {
        html = html + '</div>';
    }
    var buttons = {};
    buttons[i18n.get('Ok')] = LZ_FileSpotOK;
    addFileDialog = new dialogBox(html,{buttons:buttons, title:title}, { closeButton: i18n.get('Cancel') });
    destroyPI();
}

var takenResponseData;

function LZ_spotTakenResponse (response)
{
    deprecated();
    if (!response)
    {
        return;
    }
    LZ_assignFileToSpot(takenResponseData[0],takenResponseData[1],takenResponseData[2],true);
}

function LZ_assignFileToSpot (destroy, spot, file,force)
{
    deprecated();
    if(articleFiles.spotTaken(spot) && !force)
    {
        var spotFile = articleFiles.getFileBySpot(spot);
        if(spotFile.file_id != file)
        {
            var thisFile = articleFiles.getFileByID(file);
            takenResponseData = [destroy,spot,file];
            AuserQuestion(i18n.get_advanced('A file named "%(NAME)" (id %(ID)) is already assigned to this spot. Do you want to replace it with the file "%(NEWNAME)"?', {
                'NAME': spotFile.file.file_name,
                'ID': spotFile.file_id,
                'NEWNAME': thisFile.file.file_name
            }), 'LZ_spotTakenResponse');
            return;
        }
        else // This file is already assigned to this very spot.
        {
            destroy();
            return;
        }
    }
    destroy();
    articleFiles.assignToSpot(file,spot);
    articleFiles.buildFileList();
}

function LZ_FileSpotOK ()
{
    deprecated();
    var fileActions = document.getElementsByName('fileAction');

    var destroy = function () {
        addFileDialog.hide();
        addFileDialog.destroy();
    };
    
    for(var i = 0; i < fileActions.length; i++)
    {
        var e = fileActions[i];
        if(e.checked)
        {
            if(e.value == 'assignSpot')
            {
                LZ_assignFileToSpot(destroy, $('#spotSelector').val(), currFileUID);
                return;
            }
            else if (e.value == 'addToLead')
            {
                destroy();
                LZ_addToRTE(currFileType, currFileUID, 'inline_lead');
                return;
            }
            else if (e.value == 'addToBody')
            {
                destroy();
                LZ_addToRTE(currFileType, currFileUID, 'inline_body');
                return;
            }
            else if (e.value == 'setCaption')
            {
                var caption = $('#fileSetCaptionEntry').val();
                setCaptionForImage(destroy,caption,currFileUID);
                return;
            }
            else
            {
                destroy();
                lzError('Unrecognized value: '+e.value);
                return;
            }
        }
    }
    lzError('No spot setting appears to have been active. Had '+fileActions.length+' fileActions');
    destroy();
}

function setCaptionForImage(destroy,caption,fileId)
{
    deprecated();
    destroy();
    articleFiles.getFileFromVar(fileId).caption = caption;
}

function LZ_addToRTE (type, id, RTE)
{
    deprecated();
    if (type == 'video')
    {
        LZ_AddVideoToRTE(id,RTE);
    }
    else if (type == 'image')
    {
        LZ_AddImageToRTE(id,RTE);
    }
    else
    {
        lzError('LZ_addToRTE(): Unknown type "'+type+'"');
    }
}

function LZ_RetrieveSpots (spotType,onDone)
{
    deprecated();
    showPI(i18n.get('Fetching list of file spots...'));
    if(onDone == null)
        onDone = LZ_RetrievedSpots;

    JSON_multiRequest([ '/admin/services/templateInfo', '/admin/articles/JSON/getTakenFileSpots' ], {
            'template_id':$L('template_id').value,
            'get':'spotlist',
            'article_id':$L('artid').value,
            'type':spotType
            },onDone,null);
}

function LZ_RetrievedSpots  (data)
{
    deprecated();
    LZ_ArtFilePrompt(currFileUID,currFileType,data['/admin/services/templateInfo'].spots,data['/admin/articles/JSON/getTakenFileSpots'].taken);
}

function fileSpotTaken ()
{
    deprecated();
    stub();
}
/*
 * *************
 * Article <-> Files
 * *************
 */

var deleteThisFile = null,

    fidToNameMap = {},
    fidToCaptionMap = {};

// Add a file to an article
function LZ_addFileToArticle ()
{
    var folder = $('#folder').val();;
    newMultiFileSelector(LZ_addThisFileToArticle,folder);
}

// The function that actually adds the file, contacts the server
function LZ_addThisFileToArticle (fileIds)
{
    if (fileIds.length == 0)
    {
        return;
    }
    showPI(i18n.get('Fetching file information...'));
    var files = '';
    for(var i = 0; i < fileIds.length; i++)
    {
        files = files+'&fileId='+fileIds[i];
    }
    XHR.GET('/admin/articles/ajax?wants=fileInfo'+files,articleFiles.addTheseFiles);
}

// Initial deletion function
function LZ_deleteFileFromArticle (fileId)
{
    deleteThisFile = fileId;
    AuserQuestion(i18n.get('Are you sure you wish to remove that file from this article? The file will not be deleted.'),'LZ_reallyDeleteFile');
}

// Toggle the files section closed/open
function LZ_toggleFilesSection ()
{
    if(articleFiles.imageSpots.length == 0)
    {
        showPI(i18n.get('Retrieving file spots'));
        LZ_RetrieveSpots('image',function (data)
        {
            articleFiles.imageSpots = data['/admin/services/templateInfo'].spots;
            articleFiles.buildFileList();
            destroyPI();
            $("#files_slider_inner").slideToggle();
        });
    }
    else
    {
        $("#files_slider_inner").slideToggle();
    }
}

function buildIconItemFromEntry (entry,filesAssigned,spotlist)
{
    deprecated();
    var iconItem = '';
    try
    {
        iconItem = '<div name="fileEntry" style="height:80px; width:80px;"><img class="filePreview" style="border:0;" src="'+entry.icon+'" /></div>';
        // FIXME: Sanitize the filename length
        iconItem = iconItem+'<span class="fileName">'+entry.fileName+'</span>';
        iconItem = iconItem+'<br /><span class="fileInfo">'+i18n.get('File ID:')+' '+entry.file_id+'<br />';
        iconItem = iconItem+i18n.get('Size:')+' '+entry.sizeString+'<br />';
        var spotName = i18n.get('(none)');
        if(filesAssigned[entry.file_id])
        {
            var spot = filesAssigned[entry.file_id];
            try
            {
                for(var i = 0; i < spotlist.length; i++)
                {
                    if (spotlist[i].id == spot)
                    {
                        spotName = spotlist[i].name;
                    }
                }
            } catch(e) { lzelog(e); }
            if(spotName == i18n.get('(none)'))
            {
                lzlog('Failed to locate spot with id '+spot);
            }
        }
        iconItem = iconItem+i18n.get('Spot:')+' '+spotName;
        iconItem = iconItem+'</span>';
        fidToNameMap[entry.file_id] = entry.fileName;
        fidToCaptionMap[entry.file_id] = entry.caption;
        return iconItem;
    }
    catch(e)
    {
        lzException(e);
    }
}
