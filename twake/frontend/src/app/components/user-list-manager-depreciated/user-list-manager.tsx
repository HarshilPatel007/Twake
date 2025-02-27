import React, { useState, useEffect, useRef } from 'react';
import { Avatar, Button, Col, Row, Typography } from 'antd';
import classNames from 'classnames';
import TrashIcon from '@material-ui/icons/DeleteOutlined';

import Strings from 'app/features/global/utils/strings';
import Languages from 'app/features/global/services/languages-service';
import Icon from '../icon/icon';
import AutoCompleteExtended from 'components/auto-complete-extended/auto-complete-extended';
import { UserType } from 'app/features/users/types/user';
import UsersService from 'app/features/users/services/current-user-service';
import './elements.scss';
import './user-list-manager.scss';
import { getCurrentUserList, getUser } from 'app/features/users/hooks/use-user-list';
import { SearchContextType } from 'app/features/users/api/user-api-client';
import { searchBackend, searchFrontend } from 'app/features/users/hooks/use-search-user-list';
import _ from 'lodash';
import RouterServices from 'app/features/router/services/router-service';

const { Text } = Typography;

type PropsType = {
  [key: string]: any;
};

const useSearchUsers = ({
  scope,
}: {
  scope: SearchContextType['scope'];
}): {
  search: (str?: string) => UserType[];
  result: UserType[];
} => {
  const [_userList, setUserList] = useState(getCurrentUserList());
  let userList = _userList;
  const [query, setQuery] = useState<string | undefined>();
  userList = _.uniqBy(userList, 'id');

  const { companyId } = RouterServices.getStateFromRoute();

  const { workspaceId } = RouterServices.getStateFromRoute();
  const search = (str?: string) => {
    setQuery(str);
    return searchFrontend(str, {
      workspaceId: workspaceId || '',
      scope,
      companyId: companyId || '',
      userList: userList || [],
    });
  };

  useEffect(() => {
    searchBackend(query, { workspaceId: workspaceId || '', scope, companyId: companyId || '' });
  }, [companyId, query, scope, setUserList, workspaceId]);

  const result = searchFrontend(query, {
    workspaceId: workspaceId || '',
    scope,
    companyId: companyId || '',
    userList: userList || [],
  });

  return { search, result };
};

const UserListManager = (props: PropsType) => {
  const { result, search } = useSearchUsers({ scope: props.scope || 'company' });
  const [input, setInput] = useState<string>('');
  const [editing, setEditing] = useState<boolean>(props.autoFocus ? props.autoFocus : false);
  const [usersIds, setUsersIds] = useState<string[]>([...props.users]);
  const callback = useRef<(Function)>(() => {});
  let savedUserProps: string;

  useEffect(() => {
    updateStateFromProps(props, true);
  }, []);

  useEffect(() => {
    callback.current(result.map(u => u.id));
  }, [result]);

  const updateStateFromProps = (props: PropsType, force?: boolean) => {
    const anti_duplicates: string[] = [];

    const user_ids = props.users
      .map((item: any) => item.id || item)
      .filter((item: string) => {
        const here = anti_duplicates.indexOf(item) < 0;
        anti_duplicates.push(item);
        return here;
      });

    if (force || JSON.stringify(user_ids) !== savedUserProps) {
      setUsersIds([...user_ids]);
      savedUserProps = JSON.stringify(user_ids);
    }
  };

  const filter = (text: string, cb: (arr: any[]) => any) => {
    setInput(text);
    if ((text || '').indexOf('@') > 0) {
      if (
        props.allowMails &&
        Strings.verifyMail(text) &&
        usersIds.indexOf(text.toLocaleLowerCase()) < 0
      ) {
        cb([{ email: text.toLocaleLowerCase() }]);
        return;
      }
      cb([]);
      return;
    }

    const tmp = search(text);
    cb([...tmp.map(u => u.id)]);

    callback.current = cb;
  };

  const renderLine = (item: any, added?: boolean): JSX.Element => {
    if (!item) {
      return <></>;
    }

    if (item.email && !item.username) {
      item = item.email;
    }

    const id = item.id || item;
    let button: JSX.Element = <></>;

    if (added && !props.readOnly) {
      if (id !== UsersService.getCurrentUserId() || props.canRemoveMyself) {
        button = (
          <Col className="more">
            <TrashIcon
              key={`user_${id}`}
              className="m-icon-small remove"
              onClick={() => {
                const filteredList = usersIds.filter((id: any) =>
                  typeof item === 'string' ? item !== id : item.id !== id,
                );

                if (props.onUpdate) props.onUpdate(filteredList);
                return setUsersIds(filteredList);
              }}
            />
          </Col>
        );
      }
    }

    return (
      <>
        <UserOrMail item={item} />
        {button}
      </>
    );
  };

  const select = (id: string) => {
    if (!id) {
      return;
    }

    if (!usersIds.includes(id)) {
      const newArr = usersIds.length > 0 ? [...usersIds, id] : [id];
      setUsersIds(newArr);
      setInput('');
      if (props.onUpdate) props.onUpdate(newArr);
    }
  };
  return (
    <div
      className={classNames(['userListManager', 'menu-cancel-margin'], {
        collapsed: props.collapsed,
        big: props.big,
        medium: props.medium,
        small: props.small,
      })}
    >
      {usersIds.length > 0 && (
        <div className={'users-list no-background'}>
          {usersIds.map((item: string, index: number) => (
            <div key={index} style={props.collapsed ? { display: 'inline-block' } : {}}>
              <Row align="middle" gutter={[8, 8]} style={{ flexFlow: 'nowrap' }}>
                {renderLine(item, true)}
              </Row>
            </div>
          ))}
        </div>
      )}
      {usersIds.length === 0 && !props.noPlaceholder && (
        <div className="no-users">{Languages.t('components.userlistmanager.no_users')}</div>
      )}
      {!props.readOnly && (
        <div className="add-user-input">
          {!editing && (
            <Typography.Link
              className="small secondary-text right-margin"
              onClick={() => setEditing(true)}
            >
              <Icon type={props.buttonIcon || 'plus'} className="m-icon-small" />{' '}
              {props.buttonText ||
                Languages.t('scenes.apps.parameters.workspace_sections.members.invite_btn')}
            </Typography.Link>
          )}
          {!!editing && (
            <AutoCompleteExtended
              maxItems={props.maxResults || 5}
              align={props.onTop ? 'top' : 'bottom'}
              disabled={props.disabled || false}
              size={'large'}
              value={input}
              onSelect={select}
              style={{ width: '100%' }}
              placeholder={
                props.inputText ||
                Languages.t('scenes.apps.parameters.workspace_sections.members.invite_btn')
              }
              autoFocus
              onSearch={(text, cb) =>
                filter(text, list => {
                  cb(list);
                })
              }
              render={(user: UserType) => (
                <React.Suspense fallback={<></>}>
                  <Row align="middle" gutter={[8, 8]} style={{ flexFlow: 'nowrap' }}>
                    <UserOrMail item={user} />
                  </Row>
                </React.Suspense>
              )}
            />
          )}
          {!!props.showAddMe && usersIds.indexOf(UsersService.getCurrentUser().id) < 0 && (
            <Typography.Link
              className="small primary-text right-margin"
              onClick={() => select(UsersService.getCurrentUser().id)}
            >
              <Icon type="user" className="m-icon-small" />{' '}
              {Languages.t('components.users_picker.add_me')}
            </Typography.Link>
          )}
        </div>
      )}
      {(props.onCancel || props.onChange) && (
        <div className="menu-custom" style={{ height: 40 }}>
          {props.onCancel && (
            <Button
              value={Languages.t('general.cancel')}
              className="secondary"
              style={{ float: 'left' }}
              onClick={() => {
                if (props.onCancel) {
                  props.onCancel();
                }
                setUsersIds(props.users.map((item: any) => item.id));
              }}
            />
          )}
          {props.onChange && (
            <Button
              style={{ float: 'right' }}
              value={props.continueText || Languages.t('scenes.apps.messages.message.save_button')}
              onClick={() => props.onChange(usersIds)}
            />
          )}
        </div>
      )}
    </div>
  );
};

const EmailRow = ({ email }: { email: string }): JSX.Element => {
  return (
    <>
      <div className="icon">
        <div className="user_head email">{email.indexOf('+') === 0 ? email : '@'}</div>
      </div>
      <div className="text" style={{ fontStyle: 'italic' }}>
        {email}
      </div>
    </>
  );
};

const UserRow = ({ id }: { id: string }): JSX.Element => {
  const user = getUser(id);

  if (user) {
    console.log(UsersService.getFullName(user));
  } else {
    console.log('user not found');
  }

  return user ? (
    <>
      <Col className="icon">
        <Avatar size={20} src={UsersService.getThumbnail(user)} />
      </Col>
      <Col
        className="text"
        flex="auto"
        style={{ overflow: 'auto', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
      >
        <Text strong>{UsersService.getFullName(user)}</Text>
        <Text>{user.email ? `, ${user.email}` : ''}</Text>
      </Col>
    </>
  ) : (
    <></>
  );
};

const UserOrMail = (props: { item: any }): JSX.Element => {
  const id = props.item.id || props.item;

  if (
    typeof props.item == 'string' &&
    (props.item.indexOf('@') >= 0 || props.item.indexOf('+') === 0)
  ) {
    return <EmailRow email={props.item} />;
  } else {
    return <UserRow id={id} />;
  }
};

export default UserListManager;
