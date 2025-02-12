/*
Copyright 2022 Gravitational, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { useEffect, useRef, useState } from 'react';
import styled, { css, useTheme } from 'styled-components';
import { ButtonIcon, Flex, Link, Text } from 'design';
import { Cross } from 'design/Icon';

import type { NotificationItem, NotificationItemContent } from './types';

interface NotificationProps {
  item: NotificationItem;

  onRemove(): void;

  Icon: React.ElementType;

  getColor(theme): string;

  isAutoRemovable: boolean;
  autoRemoveDurationMs?: number;
  // Workaround until `styled` gets types.
  // Once the types are available, we can switch the type of Notification props to:
  //
  //     NotificationProps & React.ComponentProps<typeof Container>
  //
  // and remove the next line.
  [key: string]: any;
}

const defaultAutoRemoveDurationMs = 10_000; // 10s

export function Notification(props: NotificationProps) {
  const {
    item,
    onRemove,
    Icon,
    getColor,
    isAutoRemovable,
    autoRemoveDurationMs,
    ...styleProps
  } = props;
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const timeoutHandler = useRef<number>();
  const theme = useTheme();

  useEffect(() => {
    if (!isHovered && isAutoRemovable) {
      timeoutHandler.current = setTimeout(
        onRemove,
        autoRemoveDurationMs || defaultAutoRemoveDurationMs
      ) as unknown as number;
    }

    return () => {
      if (timeoutHandler.current) {
        clearTimeout(timeoutHandler.current);
      }
    };
  }, [isHovered]);

  function toggleIsExpanded() {
    setIsExpanded(wasExpanded => !wasExpanded);
  }

  const removeIcon = (
    <ButtonIcon
      size={0}
      ml={1}
      mr={-1}
      alignSelf="baseline"
      style={{ visibility: isHovered ? 'visible' : 'hidden' }}
      onClick={e => {
        e.stopPropagation();
        onRemove();
      }}
    >
      <Cross size="small" />
    </ButtonIcon>
  );

  return (
    <Container
      py={2}
      pl={3}
      pr={2}
      onMouseOver={() => {
        if (isHovered === false) {
          setIsHovered(true);
        }
      }}
      onMouseLeave={() => {
        if (isHovered === true) {
          setIsHovered(false);
        }
      }}
      onClick={toggleIsExpanded}
      {...styleProps}
    >
      <Flex alignItems="center" mr={1} minWidth="0" width="100%">
        <Icon color={getColor(theme)} mr={3} size="medium" />
        {getRenderedContent(item.content, isExpanded, removeIcon)}
      </Flex>
    </Container>
  );
}

function getRenderedContent(
  content: NotificationItemContent,
  isExpanded: boolean,
  removeIcon: React.ReactNode
) {
  const longerTextCss = isExpanded ? textCss : shortTextCss;

  if (typeof content === 'string') {
    return (
      <Flex alignItems="center" justifyContent="space-between" width="100%">
        <Text
          typography="body1"
          fontSize={13}
          lineHeight={20}
          css={longerTextCss}
        >
          {content}
        </Text>
        {removeIcon}
      </Flex>
    );
  }
  if (typeof content === 'object') {
    return (
      <Flex flexDirection="column" minWidth="0" width="100%">
        <div
          css={`
            position: relative;
          `}
        >
          <Text
            fontSize={13}
            bold
            mr="30px"
            css={`
              line-height: 20px;
            `}
          >
            {content.title}
          </Text>
          <div
            css={`
              position: absolute;
              top: 0;
              right: 0;
            `}
          >
            {removeIcon}
          </div>
        </div>
        <Text
          fontSize={13}
          lineHeight={20}
          color="text.slightlyMuted"
          css={longerTextCss}
        >
          {content.list && <List items={content.list} />}
          {content.description}
          {content.link && (
            <Link
              css={`
                display: block;
              `}
              href={content.link.href}
              target="_blank"
              onClick={e => e.stopPropagation()} // prevents notification from collapsing
            >
              {content.link.text}
            </Link>
          )}
        </Text>
      </Flex>
    );
  }
}

function List(props: { items: string[] }) {
  return (
    <ul
      // Ideally we'd align the bullet point to the left without using list-style-position: inside
      // (because it looks bad when the list item spans multiple lines).
      //
      // However, it seems impossible to use padding-inline-start for that because the result looks
      // different on Retina vs non-Retina screens, the bullet point looks cut off on the latter if
      // padding-inline-start is set to 1em. So instead we just set it to 2em.
      css={`
        margin: 0;
        padding-inline-start: 2em;
      `}
    >
      {props.items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

const textCss = css`
  line-height: 20px;
  overflow-wrap: anywhere;
  white-space: pre-line;
`;

const shortTextCss = css`
  ${textCss};
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
`;

const Container = styled(Flex)`
  flex-direction: row;
  justify-content: space-between;
  background: ${props => props.theme.colors.levels.elevated};
  min-height: 40px;
  width: 320px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.24);
  color: ${props => props.theme.colors.text.main};
  border-radius: 4px;
  cursor: pointer;
`;
