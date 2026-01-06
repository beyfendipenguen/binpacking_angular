import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { forkJoin, Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

// Material Imports
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule } from '@angular/material/paginator';
import { TranslateModule } from '@ngx-translate/core';
import { DisableAuthDirective } from '@app/core/auth/directives/disable-auth.directive';
import { IGroup, IPermission } from '@app/core/interfaces/permission.interface';
import { GroupService } from '@app/core/services/group.service';
import { PermissionService } from '@app/core/services/permission.service';
import { ToastService } from '@app/core/services/toast.service';
import { CompanyUserService } from '../access-control/services/company-user.service';
import { HasPermissionDirective } from '@app/core/auth/directives/has-permission.directive';

interface CompanyUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
  groups: number[];
  user_permissions: number[];
}

@Component({
  selector: 'app-permissions',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatPaginatorModule,
    TranslateModule,
    DisableAuthDirective,
    HasPermissionDirective
  ],
  templateUrl: './permissions.component.html',
  styleUrl: './permissions.component.scss'
})
export class PermissionsComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private permissionService = inject(PermissionService);
  private groupService = inject(GroupService);
  private companyUserService = inject(CompanyUserService);
  private toastService = inject(ToastService);
  private destroy$ = new Subject<void>();

  // Signals - Groups
  groups = signal<IGroup[]>([]);
  selectedGroup = signal<IGroup | null>(null);
  isLoadingGroups = signal(false);
  isNewGroup = signal(false);

  // Signals - Users
  allUsers = signal<CompanyUser[]>([]);
  selectedUser = signal<CompanyUser | null>(null);
  isLoadingUsers = signal(false);

  // Signals - Permissions
  allPermissions = signal<IPermission[]>([]);
  isLoadingPermissions = signal(false);

  // Signals - Common
  isSaving = signal(false);

  // Forms
  groupForm!: FormGroup;
  userForm!: FormGroup;

  // Search Controls
  searchGroupsControl = new FormControl('');
  searchUsersControl = new FormControl('');
  searchAvailablePermissionsControl = new FormControl('');
  searchSelectedPermissionsControl = new FormControl('');
  searchAvailableUsersControl = new FormControl('');
  searchSelectedUsersControl = new FormControl('');
  searchUserAvailablePermissionsControl = new FormControl('');
  searchUserSelectedPermissionsControl = new FormControl('');
  searchUserAvailableGroupsControl = new FormControl('');
  searchUserSelectedGroupsControl = new FormControl('');

  // Search Signals
  private searchGroupsSignal = toSignal(this.searchGroupsControl.valueChanges, { initialValue: '' });
  private searchUsersSignal = toSignal(this.searchUsersControl.valueChanges, { initialValue: '' });
  private searchAvailablePermissionsSignal = toSignal(this.searchAvailablePermissionsControl.valueChanges, { initialValue: '' });
  private searchSelectedPermissionsSignal = toSignal(this.searchSelectedPermissionsControl.valueChanges, { initialValue: '' });

  // Temporary Selections - Group Detail
  tempSelectedAvailablePermissions = signal<Set<number>>(new Set());
  tempSelectedInGroupPermissions = signal<Set<number>>(new Set());
  tempSelectedAvailableUsers = signal<Set<string>>(new Set());
  tempSelectedInGroupUsers = signal<Set<string>>(new Set());

  // Temporary Selections - User Detail
  tempSelectedAvailableUserPermissions = signal<Set<number>>(new Set());
  tempSelectedInUserPermissions = signal<Set<number>>(new Set());
  tempSelectedAvailableUserGroups = signal<Set<number>>(new Set());
  tempSelectedInUserGroups = signal<Set<number>>(new Set());

  // Selected IDs - Group Detail
  selectedPermissionIds = signal<Set<number>>(new Set());
  selectedUserIds = signal<Set<string>>(new Set());

  // Selected IDs - User Detail
  selectedUserPermissionIds = signal<Set<number>>(new Set());
  selectedUserGroupIds = signal<Set<number>>(new Set());

  // Computed
  isGlobalGroup = computed(() => this.selectedGroup()?.group_profile?.type === 'global');
  isEditMode = computed(() =>
    this.selectedGroup() !== null ||
    this.selectedUser() !== null ||
    this.isNewGroup()  // ← Yeni grup durumu eklendi
  );

  filteredGroups = computed(() => {
    const search = this.searchGroupsSignal()?.toLowerCase() || '';
    let filtered = this.groups();
    if (search) {
      filtered = filtered.filter(g => g.name.toLowerCase().includes(search));
    }
    return filtered;
  });

  filteredUsers = computed(() => {
    const search = this.searchUsersSignal()?.toLowerCase() || '';
    let filtered = this.allUsers();
    if (search) {
      filtered = filtered.filter(u =>
        u.first_name.toLowerCase().includes(search) ||
        u.last_name.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search) ||
        u.username.toLowerCase().includes(search)
      );
    }
    return filtered;
  });

  availablePermissions = computed(() => {
    const search = this.searchAvailablePermissionsSignal()?.toLowerCase() || '';
    const selectedIds = this.selectedPermissionIds();
    let filtered = this.allPermissions().filter(p => !selectedIds.has(p.id));
    if (search) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(search) ||
        p.codename.toLowerCase().includes(search)
      );
    }
    return filtered;
  });

  selectedPermissions = computed(() => {
    const search = this.searchSelectedPermissionsSignal()?.toLowerCase() || '';
    const selectedIds = this.selectedPermissionIds();
    let filtered = this.allPermissions().filter(p => selectedIds.has(p.id));
    if (search) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(search) ||
        p.codename.toLowerCase().includes(search)
      );
    }
    return filtered;
  });

  availableUsers = computed(() => {
    const search = this.searchAvailableUsersControl.value?.toLowerCase() || '';
    const selectedIds = this.selectedUserIds();
    let filtered = this.allUsers().filter(u => !selectedIds.has(u.id));
    if (search) {
      filtered = filtered.filter(u =>
        u.username.toLowerCase().includes(search) ||
        u.first_name.toLowerCase().includes(search) ||
        u.last_name.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search)
      );
    }
    return filtered;
  });

  selectedUsers = computed(() => {
    const search = this.searchSelectedUsersControl.value?.toLowerCase() || '';
    const selectedIds = this.selectedUserIds();
    let filtered = this.allUsers().filter(u => selectedIds.has(u.id));
    if (search) {
      filtered = filtered.filter(u =>
        u.username.toLowerCase().includes(search) ||
        u.first_name.toLowerCase().includes(search) ||
        u.last_name.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search)
      );
    }
    return filtered;
  });

  userAvailablePermissions = computed(() => {
    const search = this.searchUserAvailablePermissionsControl.value?.toLowerCase() || '';
    const selectedIds = this.selectedUserPermissionIds();
    let filtered = this.allPermissions().filter(p => !selectedIds.has(p.id));
    if (search) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(search) ||
        p.codename.toLowerCase().includes(search)
      );
    }
    return filtered;
  });

  userSelectedPermissions = computed(() => {
    const search = this.searchUserSelectedPermissionsControl.value?.toLowerCase() || '';
    const selectedIds = this.selectedUserPermissionIds();
    let filtered = this.allPermissions().filter(p => selectedIds.has(p.id));
    if (search) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(search) ||
        p.codename.toLowerCase().includes(search)
      );
    }
    return filtered;
  });

  userAvailableGroups = computed(() => {
    const search = this.searchUserAvailableGroupsControl.value?.toLowerCase() || '';
    const selectedIds = this.selectedUserGroupIds();
    let filtered = this.groups().filter(g => !selectedIds.has(g.id));
    if (search) {
      filtered = filtered.filter(g => g.name.toLowerCase().includes(search));
    }
    return filtered;
  });

  userSelectedGroups = computed(() => {
    const search = this.searchUserSelectedGroupsControl.value?.toLowerCase() || '';
    const selectedIds = this.selectedUserGroupIds();
    let filtered = this.groups().filter(g => selectedIds.has(g.id));
    if (search) {
      filtered = filtered.filter(g => g.name.toLowerCase().includes(search));
    }
    return filtered;
  });

  ngOnInit(): void {
    this.initializeForms();
    this.loadGroups();
    this.loadAllPermissions();
    this.loadAllUsers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForms(): void {
    this.groupForm = this.fb.group({
      name: ['', Validators.required]
    });

    this.userForm = this.fb.group({
      first_name: ['', Validators.required],
      last_name: ['', Validators.required]
    });
  }

  private loadGroups(): void {
    this.isLoadingGroups.set(true);
    this.groupService.getAll().pipe(
      takeUntil(this.destroy$),
      finalize(() => this.isLoadingGroups.set(false))
    ).subscribe({
      next: (response) => {
        this.groups.set(response.results);
      },
      error: (error) => {
        this.toastService.error('Failed to load groups');
      }
    });
  }

  private loadAllPermissions(): void {
    this.isLoadingPermissions.set(true);
    this.permissionService.getAll({ limit: 1000 }).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.isLoadingPermissions.set(false))
    ).subscribe({
      next: (response) => {
        this.allPermissions.set(response.results);
      },
      error: (error) => {
        this.toastService.error('Failed to load permissions');
      }
    });
  }

  private loadAllUsers(): void {
    this.isLoadingUsers.set(true);
    this.companyUserService.getAll({ limit: 1000 }).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.isLoadingUsers.set(false))
    ).subscribe({
      next: (response) => {
        this.allUsers.set(response.results);
      },
      error: (error) => {
        this.toastService.error('Failed to load users');
      }
    });
  }

  // ========== SELECTION METHODS ==========
  selectGroup(group: IGroup): void {
    this.selectedUser.set(null);
    this.selectedGroup.set(group);
    this.isNewGroup.set(false);
    this.groupForm.patchValue({ name: group.name });
    this.selectedPermissionIds.set(new Set(group.permissions));

    const usersInGroup = this.allUsers().filter(u => u.groups.includes(group.id));
    this.selectedUserIds.set(new Set(usersInGroup.map(u => u.id)));
    this.clearAllGroupTempSelections();
  }

  createNewGroup(): void {
    this.selectedUser.set(null);
    this.selectedGroup.set(null);
    this.isNewGroup.set(true);
    this.groupForm.reset();
    this.selectedPermissionIds.set(new Set());
    this.selectedUserIds.set(new Set());
    this.clearAllGroupTempSelections();
  }

  selectUser(user: CompanyUser): void {
    this.selectedGroup.set(null);
    this.isNewGroup.set(false);
    this.selectedUser.set(user);
    this.userForm.patchValue({
      first_name: user.first_name,
      last_name: user.last_name
    });

    const accessibleGroupIds = user.groups.filter(groupId => {
      const group = this.groups().find(g => g.id === groupId);
      return group !== undefined;
    });

    this.selectedUserPermissionIds.set(new Set(user.user_permissions));
    this.selectedUserGroupIds.set(new Set(accessibleGroupIds));
    this.clearAllUserTempSelections();
  }

  private clearAllGroupTempSelections(): void {
    this.tempSelectedAvailablePermissions.set(new Set());
    this.tempSelectedInGroupPermissions.set(new Set());
    this.tempSelectedAvailableUsers.set(new Set());
    this.tempSelectedInGroupUsers.set(new Set());
  }

  private clearAllUserTempSelections(): void {
    this.tempSelectedAvailableUserPermissions.set(new Set());
    this.tempSelectedInUserPermissions.set(new Set());
    this.tempSelectedAvailableUserGroups.set(new Set());
    this.tempSelectedInUserGroups.set(new Set());
  }

  // ========== GROUP PERMISSIONS TRANSFER ==========
  toggleAvailablePermissionSelection(id: number): void {
    const current = new Set(this.tempSelectedAvailablePermissions());
    current.has(id) ? current.delete(id) : current.add(id);
    this.tempSelectedAvailablePermissions.set(current);
  }

  toggleSelectedPermissionSelection(id: number): void {
    const current = new Set(this.tempSelectedInGroupPermissions());
    current.has(id) ? current.delete(id) : current.add(id);
    this.tempSelectedInGroupPermissions.set(current);
  }

  addSelectedPermissionsToGroup(): void {
    const currentSelected = new Set(this.selectedPermissionIds());
    this.tempSelectedAvailablePermissions().forEach(id => currentSelected.add(id));
    this.selectedPermissionIds.set(currentSelected);
    this.tempSelectedAvailablePermissions.set(new Set());
  }

  addAllPermissionsToGroup(): void {
    const currentSelected = new Set(this.selectedPermissionIds());
    this.availablePermissions().forEach(p => currentSelected.add(p.id));
    this.selectedPermissionIds.set(currentSelected);
  }

  removeSelectedPermissionsFromGroup(): void {
    const currentSelected = new Set(this.selectedPermissionIds());
    this.tempSelectedInGroupPermissions().forEach(id => currentSelected.delete(id));
    this.selectedPermissionIds.set(currentSelected);
    this.tempSelectedInGroupPermissions.set(new Set());
  }

  removeAllPermissionsFromGroup(): void {
    this.selectedPermissionIds.set(new Set());
  }

  // ========== GROUP USERS TRANSFER ==========
  toggleAvailableUserSelection(id: string): void {
    const current = new Set(this.tempSelectedAvailableUsers());
    current.has(id) ? current.delete(id) : current.add(id);
    this.tempSelectedAvailableUsers.set(current);
  }

  toggleSelectedUserSelection(id: string): void {
    const current = new Set(this.tempSelectedInGroupUsers());
    current.has(id) ? current.delete(id) : current.add(id);
    this.tempSelectedInGroupUsers.set(current);
  }

  addSelectedUsersToGroup(): void {
    const currentSelected = new Set(this.selectedUserIds());
    this.tempSelectedAvailableUsers().forEach(id => currentSelected.add(id));
    this.selectedUserIds.set(currentSelected);
    this.tempSelectedAvailableUsers.set(new Set());
  }

  addAllUsersToGroup(): void {
    const currentSelected = new Set(this.selectedUserIds());
    this.availableUsers().forEach(u => currentSelected.add(u.id));
    this.selectedUserIds.set(currentSelected);
  }

  removeSelectedUsersFromGroup(): void {
    const currentSelected = new Set(this.selectedUserIds());
    this.tempSelectedInGroupUsers().forEach(id => currentSelected.delete(id));
    this.selectedUserIds.set(currentSelected);
    this.tempSelectedInGroupUsers.set(new Set());
  }

  removeAllUsersFromGroup(): void {
    this.selectedUserIds.set(new Set());
  }

  // ========== USER PERMISSIONS TRANSFER ==========
  toggleUserAvailablePermissionSelection(id: number): void {
    const current = new Set(this.tempSelectedAvailableUserPermissions());
    current.has(id) ? current.delete(id) : current.add(id);
    this.tempSelectedAvailableUserPermissions.set(current);
  }

  toggleUserSelectedPermissionSelection(id: number): void {
    const current = new Set(this.tempSelectedInUserPermissions());
    current.has(id) ? current.delete(id) : current.add(id);
    this.tempSelectedInUserPermissions.set(current);
  }

  addSelectedPermissionsToUser(): void {
    const currentSelected = new Set(this.selectedUserPermissionIds());
    this.tempSelectedAvailableUserPermissions().forEach(id => currentSelected.add(id));
    this.selectedUserPermissionIds.set(currentSelected);
    this.tempSelectedAvailableUserPermissions.set(new Set());
  }

  addAllPermissionsToUser(): void {
    const currentSelected = new Set(this.selectedUserPermissionIds());
    this.userAvailablePermissions().forEach(p => currentSelected.add(p.id));
    this.selectedUserPermissionIds.set(currentSelected);
  }

  removeSelectedPermissionsFromUser(): void {
    const currentSelected = new Set(this.selectedUserPermissionIds());
    this.tempSelectedInUserPermissions().forEach(id => currentSelected.delete(id));
    this.selectedUserPermissionIds.set(currentSelected);
    this.tempSelectedInUserPermissions.set(new Set());
  }

  removeAllPermissionsFromUser(): void {
    this.selectedUserPermissionIds.set(new Set());
  }

  // ========== USER GROUPS TRANSFER ==========
  toggleUserAvailableGroupSelection(id: number): void {
    const current = new Set(this.tempSelectedAvailableUserGroups());
    current.has(id) ? current.delete(id) : current.add(id);
    this.tempSelectedAvailableUserGroups.set(current);
  }

  toggleUserSelectedGroupSelection(id: number): void {
    const current = new Set(this.tempSelectedInUserGroups());
    current.has(id) ? current.delete(id) : current.add(id);
    this.tempSelectedInUserGroups.set(current);
  }

  addSelectedGroupsToUser(): void {
    const currentSelected = new Set(this.selectedUserGroupIds());
    this.tempSelectedAvailableUserGroups().forEach(id => currentSelected.add(id));
    this.selectedUserGroupIds.set(currentSelected);
    this.tempSelectedAvailableUserGroups.set(new Set());
  }

  addAllGroupsToUser(): void {
    const currentSelected = new Set(this.selectedUserGroupIds());
    this.userAvailableGroups().forEach(g => currentSelected.add(g.id));
    this.selectedUserGroupIds.set(currentSelected);
  }

  removeSelectedGroupsFromUser(): void {
    const currentSelected = new Set(this.selectedUserGroupIds());
    this.tempSelectedInUserGroups().forEach(id => currentSelected.delete(id));
    this.selectedUserGroupIds.set(currentSelected);
    this.tempSelectedInUserGroups.set(new Set());
  }

  removeAllGroupsFromUser(): void {
    this.selectedUserGroupIds.set(new Set());
  }

  // ========== SEARCH CLEAR METHODS ==========
  clearGroupsSearch(): void { this.searchGroupsControl.setValue(''); }
  clearUsersSearch(): void { this.searchUsersControl.setValue(''); }
  clearAvailablePermissionsSearch(): void { this.searchAvailablePermissionsControl.setValue(''); }
  clearSelectedPermissionsSearch(): void { this.searchSelectedPermissionsControl.setValue(''); }
  clearAvailableUsersSearch(): void { this.searchAvailableUsersControl.setValue(''); }
  clearSelectedUsersSearch(): void { this.searchSelectedUsersControl.setValue(''); }
  clearUserAvailablePermissionsSearch(): void { this.searchUserAvailablePermissionsControl.setValue(''); }
  clearUserSelectedPermissionsSearch(): void { this.searchUserSelectedPermissionsControl.setValue(''); }
  clearUserAvailableGroupsSearch(): void { this.searchUserAvailableGroupsControl.setValue(''); }
  clearUserSelectedGroupsSearch(): void { this.searchUserSelectedGroupsControl.setValue(''); }

  // ========== SAVE & DELETE ==========
  saveGroup(): void {
    if (this.groupForm.invalid || this.isGlobalGroup()) return;

    const savedGroupId = this.isNewGroup() ? null : this.selectedGroup()!.id;

    this.isSaving.set(true);
    const groupData = {
      name: this.groupForm.value.name,
      permissions: Array.from(this.selectedPermissionIds())
    };

    const request = this.isNewGroup()
      ? this.groupService.create(groupData)
      : this.groupService.partialUpdate(savedGroupId!, groupData);

    request.pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (savedGroup) => {
        const userIds = Array.from(this.selectedUserIds());

        this.groupService.setUsers(savedGroup.id, userIds).pipe(
          takeUntil(this.destroy$)
        ).subscribe({
          next: () => {
            this.toastService.success(
              this.isNewGroup() ? 'Group created successfully' : 'Group updated successfully'
            );

            // --- DEĞİŞİKLİK BURADA BAŞLIYOR ---
            // setTimeout yerine forkJoin ile verilerin gelmesini bekliyoruz
            this.isLoadingGroups.set(true);
            this.isLoadingUsers.set(true);

            forkJoin({
              groups: this.groupService.getAll(),
              users: this.companyUserService.getAll({ limit: 1000 })
            }).pipe(
              finalize(() => {
                this.isLoadingGroups.set(false);
                this.isLoadingUsers.set(false);
                this.isSaving.set(false);
              })
            ).subscribe({
              next: (results) => {
                // 1. Sinyalleri en güncel veriyle doldur
                this.groups.set(results.groups.results);
                this.allUsers.set(results.users.results);

                // 2. Güncel listeden ilgili grubu bul
                const freshGroup = this.groups().find(g => g.id === savedGroup.id);

                // 3. Güncel veri ile seçimi yenile
                if (freshGroup) {
                  this.selectGroup(freshGroup);
                }
              },
              error: (err) => {
              }
            });
          },
          error: (error) => {
            this.toastService.error('Group saved but failed to update users');
            this.isSaving.set(false);
          }
        });
      },
      error: (error) => {
        this.toastService.error('Failed to save group');
        this.isSaving.set(false);
      }
    });
  }

  saveUser(): void {
    if (this.userForm.invalid) return;

    const user = this.selectedUser();
    if (!user) return;

    this.isSaving.set(true);

    const userData = {
      groups: Array.from(this.selectedUserGroupIds()),
      user_permissions: Array.from(this.selectedUserPermissionIds())
    };

    this.companyUserService.partialUpdate(user.id, userData).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.toastService.success('User updated successfully');

        // --- DEĞİŞİKLİK BURADA ---
        this.isLoadingGroups.set(true);
        this.isLoadingUsers.set(true);

        forkJoin({
          users: this.companyUserService.getAll({ limit: 1000 }),
          groups: this.groupService.getAll()
        }).pipe(
          finalize(() => {
            this.isLoadingGroups.set(false);
            this.isLoadingUsers.set(false);
            this.isSaving.set(false);
          })
        ).subscribe({
          next: (results) => {
            // 1. Verileri güncelle
            this.allUsers.set(results.users.results);
            this.groups.set(results.groups.results);

            // 2. Güncel user'ı bul
            const freshUser = this.allUsers().find(u => u.id === user.id);

            // 3. Yeniden seç
            if (freshUser) {
              this.selectUser(freshUser);
            }
          }
        });
      },
      error: (error) => {
        this.toastService.error('Failed to save user');
        this.isSaving.set(false);
      }
    });
  }
  deleteGroup(): void {
    const group = this.selectedGroup();
    if (!group || this.isGlobalGroup() || this.isNewGroup()) return;

    if (confirm(`Are you sure you want to delete "${group.name}"?`)) {
      this.isSaving.set(true);
      this.groupService.delete(group.id).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: () => {
          this.toastService.success('Group deleted successfully');
          this.cancelEdit();
          this.loadGroups();
          this.loadAllUsers();
          this.isSaving.set(false);
        },
        error: (error) => {
          this.toastService.error('Failed to delete group');
          this.isSaving.set(false);
        }
      });
    }
  }

  cancelEdit(): void {
    this.selectedGroup.set(null);
    this.selectedUser.set(null);
    this.isNewGroup.set(false);
  }

  // ========== HELPERS ==========
  getPermissionCount(group: IGroup): number {
    return group.permissions?.length || 0;
  }

  getUserFullName(user: CompanyUser): string {
    return `${user.first_name} ${user.last_name}`.trim() || user.username;
  }

  getUserGroupCount(user: CompanyUser): number {
    return user.groups?.length || 0;
  }

  getUserPermissionCount(user: CompanyUser): number {
    return user.user_permissions?.length || 0;
  }
}
