import { DownOutlined, RightOutlined, UpOutlined } from "@ant-design/icons";
import { NoteProps, NotePropsDict } from "@dendronhq/common-all";
import { createLogger, TreeViewUtils } from "@dendronhq/common-frontend";
import { Menu, Typography } from "antd";
import _ from "lodash";
import { DataNode } from "rc-tree/lib/interface";
import React, { useCallback, useEffect, useState } from "react";
import { DENDRON_STYLE_CONSTANTS } from "../styles/constants";
import { useDendronRouter } from "../utils/hooks";
import { NoteData, verifyNoteData } from "../utils/types";
import DendronSpinner from "./DendronSpinner";

const { SubMenu } = Menu;

export default function DendronTreeMenu(
  props: Partial<NoteData> & {
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
  }
) {
  const logger = createLogger("DendronTreeView");
  const dendronRouter = useDendronRouter();
  const { changeActiveNote } = dendronRouter;
  const [activeNoteIds, setActiveNoteIds] = useState<string[]>([]);
  const noteActiveId = _.isUndefined(dendronRouter.query.id)
    ? props.noteIndex?.id
    : dendronRouter.query.id;

  // set `activeNoteIds`
  useEffect(() => {
    if (!verifyNoteData(props) || !noteActiveId) {
      return undefined;
    }

    logger.info({
      state: "useEffect:preCalculateTree",
      noteActiveId,
      notes: props.notes,
    });

    const getAllParents = ({
      notes,
      noteId,
    }: {
      notes: NotePropsDict;
      noteId: string;
    }) => {
      let pNote: NoteProps = notes[noteId];
      logger.info({ state: "getAllParents:enter", noteId, notes, pNote });
      const activeNoteIds: string[] = [];
      if (!pNote) {
        logger.info({
          state: "getAllParents:pNote note found",
          noteId,
          notes,
          pNote,
        });
        return [];
      }
      do {
        activeNoteIds.unshift(pNote.id);
        logger.info({ state: "getAllParents:do:1", pNote });
        pNote = notes[pNote.parent as string];
        logger.info({ state: "getAllParents:do:2", pNote });
      } while (pNote);
      logger.info({
        state: "getAllParents:exit",
        activeNoteIds,
        noteId,
        notes,
      });
      return activeNoteIds;
    };

    // all parents should be in expanded position
    const activeNoteIds = getAllParents({
      notes: props.notes,
      noteId: noteActiveId,
    });

    setActiveNoteIds(activeNoteIds);
  }, [props.notes, props.noteIndex, dendronRouter.query.id, noteActiveId]);

  // --- Verify
  // If no data, show spinner component
  if (!verifyNoteData(props)) {
    logger.info({
      state: "exit:notes not initialized",
    });
    return <DendronSpinner />;
  }

  const { notes, domains, collapsed, setCollapsed } = props;

  const expandKeys = _.isEmpty(activeNoteIds) ? [] : activeNoteIds;

  // --- Calc
  const roots: DataNode[] = domains
    .map((note) => {
      return TreeViewUtils.note2TreeDatanote({
        noteId: note.id,
        noteDict: notes,
        showVaultName: false,
        applyNavExclude: true,
      });
    })
    .filter((ent): ent is DataNode => !_.isUndefined(ent));

  // --- Methods
  const onSelect = (noteId: string) => {
    setCollapsed(true);
    logger.info({ ctx: "onSelect", id: noteId });
    changeActiveNote(noteId, { noteIndex: props.noteIndex });
  };

  const onExpand = (noteId: string) => {
    logger.info({ ctx: "onExpand", id: noteId });
    if (_.isUndefined(notes)) {
      return;
    }
    const expanded = expandKeys.includes(noteId);
    // open up
    if (expanded) {
      setActiveNoteIds(
        TreeViewUtils.getAllParents({ notes, noteId }).slice(0, -1)
      );
    } else {
      setActiveNoteIds(TreeViewUtils.getAllParents({ notes, noteId }));
    }
  };

  return (
    <MenuView
      roots={roots}
      expandKeys={expandKeys}
      onSelect={onSelect}
      onExpand={onExpand}
      collapsed={collapsed}
      activeNote={noteActiveId}
    />
  );
}

function MenuView({
  roots,
  expandKeys,
  onSelect,
  onExpand,
  collapsed,
  activeNote,
}: {
  roots: DataNode[];
  expandKeys: string[];
  onSelect: (noteId: string) => void;
  onExpand: (noteId: string) => void;
  collapsed: boolean;
  activeNote: string | undefined;
}) {
  const ExpandIcon = useCallback(
    ({ isOpen, ...rest }: { isOpen: boolean }) => {
      const UncollapsedIcon = isOpen ? UpOutlined : DownOutlined;
      const Icon = collapsed ? RightOutlined : UncollapsedIcon;
      return (
        <i data-expandedicon="true">
          <Icon
            style={{
              pointerEvents: "none", // only allow custom element to be gesture target
              margin: 0,
            }}
          />
        </i>
      );
    },
    [collapsed]
  );

  const createMenu = (menu: DataNode) => {
    if (menu.children && menu.children.length > 0) {
      return (
        <SubMenu
          icon={menu.icon}
          className={
            menu.key === activeNote ? "dendron-ant-menu-submenu-selected" : ""
          }
          key={menu.key}
          title={
            <Typography.Text
              style={{ width: "100%" }}
              ellipsis={{ tooltip: menu.title }}
            >
              {menu.title}
            </Typography.Text>
          }
          onTitleClick={(event) => {
            const target = event.domEvent.target as HTMLElement;
            const isArrow = target.dataset.expandedicon;
            if (!isArrow) {
              onSelect(event.key);
            } else {
              onExpand(event.key);
            }
          }}
        >
          {menu.children.map((childMenu: DataNode) => {
            return createMenu(childMenu);
          })}
        </SubMenu>
      );
    }
    return (
      <Menu.Item key={menu.key} icon={menu.icon}>
        <Typography.Text
          style={{ width: "100%" }}
          ellipsis={{ tooltip: menu.title }}
        >
          {menu.title}
        </Typography.Text>
      </Menu.Item>
    );
  };

  if (activeNote) {
    expandKeys.push(activeNote);
  }

  return (
    <Menu
      key={String(collapsed)}
      className="dendron-tree-menu"
      mode="inline"
      {...(!collapsed && {
        openKeys: expandKeys,
        selectedKeys: expandKeys,
      })}
      onClick={({ key }) => onSelect(key as string)}
      inlineIndent={DENDRON_STYLE_CONSTANTS.SIDER.INDENT}
      expandIcon={ExpandIcon}
      inlineCollapsed={collapsed}
    >
      {roots.map((menu) => {
        return createMenu(menu);
      })}
    </Menu>
  );
}
