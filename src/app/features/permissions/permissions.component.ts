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
import { Subject } from 'rxjs';
import { takeUntil, debounceTime } from 'rxjs/operators';

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
import { PermissionTranslatePipe } from '@app/shared/permission-denied/pipes/permission-translate.pipe';
import { CompanyUserService } from '../access-control/services/company-user.service';
import { HasPermissionDirective } from '@app/core/auth/directives/has-permission.directive';

// Services & Models

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
    PermissionTranslatePipe,
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
  isSaving = signal(false);

  // Signals - Permissions
  allPermissions = signal<IPermission[]>([]);
  isLoadingPermissions = signal(false);
  
  // Signals - Users
  allUsers = signal<CompanyUser[]>([]);
  isLoadingUsers = signal(false);

  // Form
  groupForm!: FormGroup;
  
  // Search Controls
  searchAvailablePermissionsControl = new FormControl('');
  searchSelectedPermissionsControl = new FormControl('');
  searchAvailableUsersControl = new FormControl('');
  searchSelectedUsersControl = new FormControl('');

  // Temporary Selections (for transfer buttons)
  tempSelectedAvailablePermissions = signal<Set<number>>(new Set());
  tempSelectedInGroupPermissions = signal<Set<number>>(new Set());
  tempSelectedAvailableUsers = signal<Set<string>>(new Set());
  tempSelectedInGroupUsers = signal<Set<string>>(new Set());

  // Selected IDs
  selectedPermissionIds = signal<Set<number>>(new Set());
  selectedUserIds = signal<Set<string>>(new Set());

  // Computed
  isGlobalGroup = computed(() => 
    this.selectedGroup()?.group_profile?.type === 'global'
  );

  // Available Permissions (not in group)
  availablePermissions = computed(() => {
    const search = this.searchAvailablePermissionsControl.value?.toLowerCase() || '';
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

  // Selected Permissions (in group)
  selectedPermissions = computed(() => {
    const search = this.searchSelectedPermissionsControl.value?.toLowerCase() || '';
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

  // Available Users (not in group)
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

  // Selected Users (in group)
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

  ngOnInit(): void {
    this.initializeForm();
    this.loadGroups();
    this.loadAllPermissions();
    this.loadAllUsers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.groupForm = this.fb.group({
      name: ['', Validators.required]
    });
  }

  private loadGroups(): void {
    this.isLoadingGroups.set(true);
    this.groupService.getAll().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        this.groups.set(response.results);
        this.isLoadingGroups.set(false);
      },
      error: (error) => {
        console.error('Error loading groups:', error);
        this.toastService.error('Failed to load groups');
        this.isLoadingGroups.set(false);
      }
    });
  }

  private loadAllPermissions(): void {
    this.isLoadingPermissions.set(true);
    this.permissionService.getAll({ limit: 1000 }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        this.allPermissions.set(response.results);
        this.isLoadingPermissions.set(false);
      },
      error: (error) => {
        console.error('Error loading permissions:', error);
        this.toastService.error('Failed to load permissions');
        this.isLoadingPermissions.set(false);
      }
    });
  }

  private loadAllUsers(): void {
    this.isLoadingUsers.set(true);
    this.companyUserService.getAll({ page_size: 10000 }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        this.allUsers.set(response.results);
        this.isLoadingUsers.set(false);
      },
      error: (error) => {
        console.error('Error loading users:', error);
        this.toastService.error('Failed to load users');
        this.isLoadingUsers.set(false);
      }
    });
  }

  selectGroup(group: IGroup): void {
    this.selectedGroup.set(group);
    this.isNewGroup.set(false);
    this.groupForm.patchValue({ name: group.name });
    this.selectedPermissionIds.set(new Set(group.permissions));
    
    // Load users in this group
    const usersInGroup = this.allUsers().filter(u => u.groups.includes(group.id));
    this.selectedUserIds.set(new Set(usersInGroup.map(u => u.id)));
    
    // Clear temp selections
    this.clearAllTempSelections();
  }

  createNewGroup(): void {
    this.selectedGroup.set(null);
    this.isNewGroup.set(true);
    this.groupForm.reset();
    this.selectedPermissionIds.set(new Set());
    this.selectedUserIds.set(new Set());
    this.clearAllTempSelections();
  }

  private clearAllTempSelections(): void {
    this.tempSelectedAvailablePermissions.set(new Set());
    this.tempSelectedInGroupPermissions.set(new Set());
    this.tempSelectedAvailableUsers.set(new Set());
    this.tempSelectedInGroupUsers.set(new Set());
  }

  // ========== PERMISSION TRANSFER METHODS ==========
  
  toggleAvailablePermissionSelection(id: number): void {
    const current = new Set(this.tempSelectedAvailablePermissions());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.tempSelectedAvailablePermissions.set(current);
  }

  toggleSelectedPermissionSelection(id: number): void {
    const current = new Set(this.tempSelectedInGroupPermissions());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
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

  // ========== USER TRANSFER METHODS ==========

  toggleAvailableUserSelection(id: string): void {
    const current = new Set(this.tempSelectedAvailableUsers());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.tempSelectedAvailableUsers.set(current);
  }

  toggleSelectedUserSelection(id: string): void {
    const current = new Set(this.tempSelectedInGroupUsers());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
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

  // ========== SEARCH CLEAR ==========

  clearAvailablePermissionsSearch(): void {
    this.searchAvailablePermissionsControl.setValue('');
  }

  clearSelectedPermissionsSearch(): void {
    this.searchSelectedPermissionsControl.setValue('');
  }

  clearAvailableUsersSearch(): void {
    this.searchAvailableUsersControl.setValue('');
  }

  clearSelectedUsersSearch(): void {
    this.searchSelectedUsersControl.setValue('');
  }

  // ========== SAVE & DELETE ==========

  saveGroup(): void {
    if (this.groupForm.invalid || this.isGlobalGroup()) return;

    this.isSaving.set(true);
    const formValue = this.groupForm.value;
    const groupData = {
      name: formValue.name,
      permissions: Array.from(this.selectedPermissionIds())
    };

    const request = this.isNewGroup()
      ? this.groupService.create(groupData)
      : this.groupService.partialUpdate(this.selectedGroup()!.id, groupData);

    request.pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (savedGroup) => {
        // Update users' groups
        this.updateUsersGroups(savedGroup.id);
        
        this.toastService.success(
          this.isNewGroup() ? 'Group created successfully' : 'Group updated successfully'
        );
        this.loadGroups();
        this.selectGroup(savedGroup);
        this.isSaving.set(false);
      },
      error: (error) => {
        console.error('Error saving group:', error);
        this.toastService.error('Failed to save group');
        this.isSaving.set(false);
      }
    });
  }

  private updateUsersGroups(groupId: number): void {
    const selectedUserIds = Array.from(this.selectedUserIds());
    
    // Add group to selected users
    selectedUserIds.forEach(userId => {
      const user = this.allUsers().find(u => u.id === userId);
      if (user && !user.groups.includes(groupId)) {
        this.companyUserService.partialUpdate(userId, {
          groups: [...user.groups, groupId]
        }).subscribe();
      }
    });

    // Remove group from unselected users
    this.allUsers().forEach(user => {
      if (!selectedUserIds.includes(user.id) && user.groups.includes(groupId)) {
        this.companyUserService.partialUpdate(user.id, {
          groups: user.groups.filter(g => g !== groupId)
        }).subscribe();
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
          this.selectedGroup.set(null);
          this.isNewGroup.set(false);
          this.loadGroups();
          this.isSaving.set(false);
        },
        error: (error) => {
          console.error('Error deleting group:', error);
          this.toastService.error('Failed to delete group');
          this.isSaving.set(false);
        }
      });
    }
  }

  getPermissionCount(group: IGroup): number {
    return group.permissions?.length || 0;
  }

  getUserFullName(user: CompanyUser): string {
    return `${user.first_name} ${user.last_name}`.trim() || user.username;
  }
}